from flask import Flask, render_template, request, redirect, url_for, session, jsonify, Response
from werkzeug.security import check_password_hash, generate_password_hash
from database import *
import csv
import io
from datetime import datetime
import os

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY')

@app.route('/')
def index():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return redirect(url_for('dashboard'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        nome = request.form['nome']
        senha = request.form.get('senha', '')
        
        user = get_usuario_com_senha(nome)
        
        if not user:
            usuarios = get_all_usuarios()
            usuarios_com_senha = get_all_usuarios_com_senha()
            return render_template('login.html', 
                                 usuarios=usuarios,
                                 usuarios_com_senha=usuarios_com_senha,
                                 erro="Usuário não encontrado")
        
        # Verificar se é primeiro acesso ou senha resetada
        if user['primeiro_acesso'] or not user['senha_hash']:
            # Salvar na sessão que precisa definir senha
            session['reset_user_id'] = user['id']
            session['reset_user_name'] = user['nome']
            return redirect(url_for('primeiro_acesso'))
        
        # Verificar senha (apenas para quem já tem senha)
        if not senha:
            usuarios = get_all_usuarios()
            usuarios_com_senha = get_all_usuarios_com_senha()
            return render_template('login.html', 
                                 usuarios=usuarios,
                                 usuarios_com_senha=usuarios_com_senha,
                                 erro="Por favor, informe sua senha")
        
        if check_password_hash(user['senha_hash'], senha):
            session['user_id'] = user['id']
            session['user_name'] = user['nome']
            session['user_type'] = user['tipo']
            return redirect(url_for('dashboard'))
        else:
            usuarios = get_all_usuarios()
            usuarios_com_senha = get_all_usuarios_com_senha()
            return render_template('login.html', 
                                 usuarios=usuarios,
                                 usuarios_com_senha=usuarios_com_senha,
                                 erro="Senha incorreta")
    
    usuarios = get_all_usuarios()
    usuarios_com_senha = get_all_usuarios_com_senha()
    return render_template('login.html', 
                         usuarios=usuarios,
                         usuarios_com_senha=usuarios_com_senha,
                         erro=None)

@app.route('/primeiro-acesso', methods=['GET', 'POST'])
def primeiro_acesso():
    # Verificar se há um usuário aguardando definir senha
    if 'reset_user_id' not in session:
        return redirect(url_for('login'))
    
    if request.method == 'POST':
        senha = request.form['senha']
        confirmar = request.form['confirmar_senha']
        
        # Validar senha
        if len(senha) < 6:
            return render_template('primeiro_acesso.html', 
                                 erro="A senha deve ter no mínimo 6 caracteres",
                                 nome=session['reset_user_name'])
        
        if senha != confirmar:
            return render_template('primeiro_acesso.html', 
                                 erro="As senhas não coincidem",
                                 nome=session['reset_user_name'])
        
        # Criar hash da senha e salvar
        senha_hash = generate_password_hash(senha, method='pbkdf2:sha256')
        atualizar_senha(session['reset_user_id'], senha_hash)
        
        # Limpar sessão temporária e fazer login
        user = get_usuario_by_id(session['reset_user_id'])
        session.pop('reset_user_id', None)
        session.pop('reset_user_name', None)
        
        session['user_id'] = user['id']
        session['user_name'] = user['nome']
        session['user_type'] = user['tipo']
        
        return redirect(url_for('dashboard'))
    
    return render_template('primeiro_acesso.html', 
                         nome=session['reset_user_name'],
                         erro=None)

@app.route('/alterar-senha', methods=['GET', 'POST'])
def alterar_senha():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    if request.method == 'POST':
        senha_atual = request.form['senha_atual']
        nova_senha = request.form['nova_senha']
        confirmar_senha = request.form['confirmar_senha']
        
        # Buscar usuário atual
        user = get_usuario_com_senha(session['user_name'])
        
        # Verificar senha atual
        if not check_password_hash(user['senha_hash'], senha_atual):
            return render_template('alterar_senha.html', 
                                 erro="Senha atual incorreta")
        
        # Validar nova senha
        if len(nova_senha) < 6:
            return render_template('alterar_senha.html', 
                                 erro="A nova senha deve ter no mínimo 6 caracteres")
        
        if nova_senha != confirmar_senha:
            return render_template('alterar_senha.html', 
                                 erro="As novas senhas não coincidem")
        
        # Atualizar senha
        nova_senha_hash = generate_password_hash(nova_senha, method='pbkdf2:sha256')
        atualizar_senha(session['user_id'], nova_senha_hash)
        
        return redirect(url_for('dashboard'))
    
    return render_template('alterar_senha.html', erro=None)

@app.route('/admin/usuarios')
def admin_usuarios():
    if session.get('user_type') != 'admin':
        return redirect(url_for('dashboard'))
    
    usuarios = get_all_usuarios_com_senha()
    return render_template('admin_usuarios.html', usuarios=usuarios)

@app.route('/admin/resetar-senha/<int:usuario_id>', methods=['POST'])
def admin_resetar_senha(usuario_id):
    if session.get('user_type') != 'admin':
        return jsonify({'error': 'Acesso negado'}), 403
    
    resetar_senha(usuario_id)
    return jsonify({'message': 'Senha resetada com sucesso. Usuário deve definir nova senha no próximo acesso.'})

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return render_template('dashboard.html', 
                         user_name=session['user_name'],
                         user_type=session['user_type'])

@app.route('/api/tarefas')
def api_tarefas():
    """API para buscar todas as tarefas (JSON)"""
    tarefas = get_all_tarefas()
    # Converter date para string
    for t in tarefas:
        if t['data_inicio']:
            t['data_inicio'] = t['data_inicio'].isoformat()
        if t['data_fim']:
            t['data_fim'] = t['data_fim'].isoformat()
    return jsonify(tarefas)

@app.route('/api/tarefa/<int:tarefa_id>')
def api_tarefa(tarefa_id):
    """API para buscar uma tarefa específica"""
    tarefa = get_tarefa_by_id(tarefa_id)
    if tarefa:
        if tarefa['data_inicio']:
            tarefa['data_inicio'] = tarefa['data_inicio'].isoformat()
        if tarefa['data_fim']:
            tarefa['data_fim'] = tarefa['data_fim'].isoformat()
    return jsonify(tarefa)

@app.route('/api/tarefa', methods=['POST'])
def api_create_tarefa():
    """API para criar nova tarefa (admin apenas)"""
    if session.get('user_type') != 'admin':
        return jsonify({'error': 'Acesso negado'}), 403
    
    data = request.json
    tarefa_id = create_tarefa(data)
    return jsonify({'id': tarefa_id, 'message': 'Tarefa criada com sucesso'})

@app.route('/api/tarefa/<int:tarefa_id>', methods=['PUT'])
def api_update_tarefa(tarefa_id):
    """API para atualizar tarefa (admin apenas)"""
    if session.get('user_type') != 'admin':
        return jsonify({'error': 'Acesso negado'}), 403
    
    data = request.json
    update_tarefa(tarefa_id, data)
    return jsonify({'message': 'Tarefa atualizada com sucesso'})

@app.route('/api/tarefa/<int:tarefa_id>', methods=['DELETE'])
def api_delete_tarefa(tarefa_id):
    """API para excluir tarefa (admin apenas)"""
    if session.get('user_type') != 'admin':
        return jsonify({'error': 'Acesso negado'}), 403
    
    delete_tarefa(tarefa_id)
    return jsonify({'message': 'Tarefa excluída com sucesso'})

@app.route('/export/csv')
def export_csv():
    """Exporta todas as tarefas para CSV com codificação correta para português"""
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    tarefas = get_tarefas_export_csv()
    
    # Usar UTF-8 com BOM (Byte Order Mark) para compatibilidade com Excel
    output = io.StringIO()
    
    # Para Excel brasileiro, usar ponto e vírgula como separador
    writer = csv.writer(output, delimiter=';', quoting=csv.QUOTE_MINIMAL)
    
    # Cabeçalho
    writer.writerow(['Nome', 'Descrição', 'Responsável', 'Participantes', 
                    'Data Início', 'Data Fim', 'Duração (dias úteis)', 'Prioridade', 'Status'])
    
    # Dados
    for t in tarefas:
        writer.writerow([
            t['nome'],
            t['descricao'],
            t['responsavel'],
            t['participantes'],
            t['data_inicio'],
            t['data_fim'],
            t['duracao_dias_uteis'],
            t['prioridade'],
            t['status']
        ])
    
    # Converter para bytes com UTF-8 com BOM
    output.seek(0)
    csv_content = output.getvalue().encode('utf-8-sig')  # utf-8-sig adiciona BOM
    
    return Response(
        csv_content,
        mimetype='text/csv',
        headers={'Content-Disposition': 'attachment; filename=tarefas_export.csv'}
    )

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)