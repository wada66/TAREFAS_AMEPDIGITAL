from flask import Flask, render_template, request, redirect, url_for, session, jsonify, Response
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
        user = get_usuario_by_nome(nome)
        if user:
            session['user_id'] = user['id']
            session['user_name'] = user['nome']
            session['user_type'] = user['tipo']
            return redirect(url_for('dashboard'))
    usuarios = get_all_usuarios()
    return render_template('login.html', usuarios=usuarios)

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
    """Exporta todas as tarefas para CSV"""
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    tarefas = get_tarefas_export_csv()
    
    output = io.StringIO()
    writer = csv.writer(output)
    
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
    
    output.seek(0)
    return Response(
        output,
        mimetype='text/csv',
        headers={'Content-Disposition': 'attachment; filename=tarefas_export.csv'}
    )

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)