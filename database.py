import pg8000
from pg8000.native import Connection, DatabaseError
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

def get_db_connection():
    """Retorna conexão com PostgreSQL usando pg8000"""
    conn = Connection(
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        host=os.getenv('DB_HOST'),
        port=int(os.getenv('DB_PORT', 5432)),
        database=os.getenv('DB_NAME')
    )
    return conn

def get_usuario_by_nome(nome):
    conn = get_db_connection()
    try:
        result = conn.run("SELECT * FROM usuarios WHERE nome = :nome", nome=nome)
        if result:
            return {'id': result[0][0], 'nome': result[0][1], 'tipo': result[0][2]}
        return None
    finally:
        conn.close()

def get_all_usuarios():
    """Retorna todos os usuários para tela de login (inclui status de primeiro acesso)"""
    conn = get_db_connection()
    try:
        result = conn.run("""
            SELECT nome, tipo, 
                   CASE WHEN senha_hash IS NULL OR primeiro_acesso = TRUE THEN TRUE ELSE FALSE END as primeiro_acesso
            FROM usuarios 
            ORDER BY nome
        """)
        return [{'nome': row[0], 'tipo': row[1], 'primeiro_acesso': row[2]} for row in result]
    finally:
        conn.close()

def get_all_tarefas():
    conn = get_db_connection()
    try:
        result = conn.run("""
            SELECT id, nome, descricao, link_externo, responsavel, participantes, equipes_envolvidas,
                   data_inicio, duracao_dias_uteis, data_fim, prioridade, status, tipo
            FROM tarefas
            ORDER BY 
                CASE status
                WHEN 'Atrasado' THEN 1
                WHEN 'Em Andamento' THEN 2
                WHEN 'Nao Iniciado' THEN 3
                WHEN 'Reuniao' THEN 4
                WHEN 'Treinamento' THEN 5
                WHEN 'Pausado' THEN 6
                WHEN 'Concluido' THEN 7
                ELSE 8
            END,
            data_inicio
    """)
        return [{
            'id': row[0], 'nome': row[1], 'descricao': row[2], 'link_externo': row[3],
            'responsavel': row[4], 'participantes': row[5], 'equipes_envolvidas': row[6],
            'data_inicio': row[7], 'duracao_dias_uteis': row[8], 'data_fim': row[9], 
            'prioridade': row[10], 'status': row[11], 'tipo_tarefa': row[12]
        } for row in result]
    finally:
        conn.close()

def get_tarefa_by_id(tarefa_id):
    conn = get_db_connection()
    try:
        result = conn.run("SELECT * FROM tarefas WHERE id = :id", id=tarefa_id)
        if result:
            row = result[0]
            return {
                'id': row[0], 'nome': row[1], 'descricao': row[2], 'link_externo': row[3],
                'responsavel': row[4], 'participantes': row[5], 'equipes_envolvidas': row[6],
                'data_inicio': row[7], 'duracao_dias_uteis': row[8], 'data_fim': row[9], 
                'prioridade': row[10], 'status': row[11], 'criado_em': row[12], 'atualizado_em': row[13], 'tipo_tarefa': row[14]
            }
        return None
    finally:
        conn.close()

def create_tarefa(data):
    conn = get_db_connection()
    try:
        # Calcular data_fim em dias úteis
        data_fim = calcular_data_fim(data['data_inicio'], int(data['duracao_dias_uteis']))
        
        result = conn.run("""
            INSERT INTO tarefas (nome, descricao, link_externo, responsavel, participantes, equipes_envolvidas,
                                 data_inicio, duracao_dias_uteis, data_fim, prioridade, status, tipo)
            VALUES (:nome, :descricao, :link_externo, :responsavel, :participantes, :equipes_envolvidas,
                    :data_inicio, :duracao_dias_uteis, :data_fim, :prioridade, :status, :tipo)
            RETURNING id
        """,
        nome=data['nome'],
        descricao=data.get('descricao', ''),
        link_externo=data.get('link_externo', ''),
        responsavel=data['responsavel'],
        participantes=data.get('participantes', ''),
        equipes_envolvidas=data.get('equipes_envolvidas', ''),  # ← NOVO
        data_inicio=data['data_inicio'],
        duracao_dias_uteis=int(data['duracao_dias_uteis']),
        data_fim=data_fim,
        prioridade=data['prioridade'],
        status=data['status'],
        tipo=data.get('tipo_tarefa', 'Normal')
        )
        return result[0][0]
    finally:
        conn.close()

def update_tarefa(tarefa_id, data):
    conn = get_db_connection()
    try:
        # Calcular data_fim em dias úteis
        data_fim = calcular_data_fim(data['data_inicio'], int(data['duracao_dias_uteis']))
        
        conn.run("""
            UPDATE tarefas
            SET nome = :nome, descricao = :descricao, link_externo = :link_externo,
                responsavel = :responsavel, participantes = :participantes, equipes_envolvidas = :equipes_envolvidas,
                data_inicio = :data_inicio, duracao_dias_uteis = :duracao_dias_uteis,
                data_fim = :data_fim, prioridade = :prioridade, status = :status, tipo = :tipo,
                atualizado_em = CURRENT_TIMESTAMP
            WHERE id = :id
        """,
        id=tarefa_id,
        nome=data['nome'],
        descricao=data.get('descricao', ''),
        link_externo=data.get('link_externo', ''),
        responsavel=data['responsavel'],
        participantes=data.get('participantes', ''),
        equipes_envolvidas=data.get('equipes_envolvidas', ''),  # ← NOVO
        data_inicio=data['data_inicio'],
        duracao_dias_uteis=int(data['duracao_dias_uteis']),
        data_fim=data_fim,
        prioridade=data['prioridade'],
        tipo=data.get('tipo_tarefa', 'Normal'),
        status=data['status']
        )
    finally:
        conn.close()

def delete_tarefa(tarefa_id):
    conn = get_db_connection()
    try:
        conn.run("DELETE FROM tarefas WHERE id = :id", id=tarefa_id)
    finally:
        conn.close()

def get_tarefas_export_csv():
    conn = get_db_connection()
    try:
        result = conn.run("""
            SELECT nome, descricao, responsavel, participantes, equipes_envolvidas,
                   data_inicio, data_fim, duracao_dias_uteis, prioridade, status
            FROM tarefas
            ORDER BY data_inicio
        """)
        return [{
            'nome': row[0], 'descricao': row[1], 'responsavel': row[2],
            'participantes': row[3], 'equipes_envolvidas': row[4],
            'data_inicio': row[5], 'data_fim': row[6],
            'duracao_dias_uteis': row[7], 'prioridade': row[8], 'status': row[9]
        } for row in result]
    finally:
        conn.close()

def calcular_data_fim(data_inicio_str, dias_uteis):
    """Calcula a data fim considerando apenas dias úteis (segunda a sexta)"""
    data_inicio = datetime.strptime(data_inicio_str, '%Y-%m-%d')
    data_atual = data_inicio
    dias_contados = 1  # ← COMEÇA EM 1 (já conta o dia atual)
    
    # Se duração for 1, retorna a própria data de início
    if dias_uteis <= 1:
        return data_inicio.strftime('%Y-%m-%d')
    
    while dias_contados < dias_uteis:
        data_atual += timedelta(days=1)
        # 0 = segunda, 1 = terça, ..., 5 = sábado, 6 = domingo
        if data_atual.weekday() < 5:  # 0-4 = dias úteis
            dias_contados += 1
    
    return data_atual.strftime('%Y-%m-%d')
    
    return data_atual.strftime('%Y-%m-%d')

def create_user_senha(nome, senha_hash):
    """Cria novo usuário com senha (para primeiro acesso)"""
    conn = get_db_connection()
    try:
        conn.run("""
            INSERT INTO usuarios (nome, tipo, senha_hash, primeiro_acesso, senha_alterada_em)
            VALUES (:nome, 'tecnico', :senha_hash, FALSE, CURRENT_TIMESTAMP)
        """, nome=nome, senha_hash=senha_hash)
    finally:
        conn.close()

def get_usuario_com_senha(nome):
    """Busca usuário incluindo informações de senha"""
    conn = get_db_connection()
    try:
        result = conn.run("""
            SELECT id, nome, tipo, senha_hash, primeiro_acesso, senha_alterada_em
            FROM usuarios 
            WHERE nome = :nome
        """, nome=nome)
        if result:
            row = result[0]
            return {
                'id': row[0], 'nome': row[1], 'tipo': row[2],
                'senha_hash': row[3], 'primeiro_acesso': row[4],
                'senha_alterada_em': row[5]
            }
        return None
    finally:
        conn.close()

def atualizar_senha(usuario_id, nova_senha_hash):
    """Atualiza a senha do usuário e marca primeiro_acesso = FALSE"""
    conn = get_db_connection()
    try:
        conn.run("""
            UPDATE usuarios 
            SET senha_hash = :senha_hash, 
                primeiro_acesso = FALSE, 
                senha_alterada_em = CURRENT_TIMESTAMP
            WHERE id = :id
        """, id=usuario_id, senha_hash=nova_senha_hash)
    finally:
        conn.close()

def resetar_senha(usuario_id):
    """Reseta a senha do usuário (força primeiro_acesso = TRUE)"""
    conn = get_db_connection()
    try:
        # Remove a senha existente e marca primeiro acesso
        conn.run("""
            UPDATE usuarios 
            SET senha_hash = NULL, 
                primeiro_acesso = TRUE, 
                senha_alterada_em = NULL
            WHERE id = :id
        """, id=usuario_id)
    finally:
        conn.close()

def get_all_usuarios_com_senha():
    """Retorna todos os usuários com informações de senha (para admin)"""
    conn = get_db_connection()
    try:
        result = conn.run("""
            SELECT id, nome, tipo, primeiro_acesso, senha_alterada_em
            FROM usuarios 
            ORDER BY nome
        """)
        return [{'id': row[0], 'nome': row[1], 'tipo': row[2], 
                 'primeiro_acesso': row[3], 'senha_alterada_em': row[4]} 
                for row in result]
    finally:
        conn.close()
        
def get_usuario_by_id(usuario_id):
    """Busca usuário pelo ID"""
    conn = get_db_connection()
    try:
        result = conn.run("SELECT id, nome, tipo FROM usuarios WHERE id = :id", id=usuario_id)
        if result:
            row = result[0]
            return {
                'id': row[0],
                'nome': row[1],
                'tipo': row[2]
            }
        return None
    finally:
        conn.close()