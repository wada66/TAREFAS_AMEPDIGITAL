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
    conn = get_db_connection()
    try:
        result = conn.run("SELECT nome, tipo FROM usuarios ORDER BY nome")
        return [{'nome': row[0], 'tipo': row[1]} for row in result]
    finally:
        conn.close()

def get_all_tarefas():
    conn = get_db_connection()
    try:
        result = conn.run("""
            SELECT id, nome, descricao, link_externo, responsavel, participantes,
                   data_inicio, duracao_dias_uteis, data_fim, prioridade, status
            FROM tarefas
            ORDER BY data_inicio
        """)
        return [{
            'id': row[0], 'nome': row[1], 'descricao': row[2], 'link_externo': row[3],
            'responsavel': row[4], 'participantes': row[5], 'data_inicio': row[6],
            'duracao_dias_uteis': row[7], 'data_fim': row[8], 'prioridade': row[9], 'status': row[10]
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
                'responsavel': row[4], 'participantes': row[5], 'data_inicio': row[6],
                'duracao_dias_uteis': row[7], 'data_fim': row[8], 'prioridade': row[9],
                'status': row[10], 'criado_em': row[11], 'atualizado_em': row[12]
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
            INSERT INTO tarefas (nome, descricao, link_externo, responsavel, participantes,
                                 data_inicio, duracao_dias_uteis, data_fim, prioridade, status)
            VALUES (:nome, :descricao, :link_externo, :responsavel, :participantes,
                    :data_inicio, :duracao_dias_uteis, :data_fim, :prioridade, :status)
            RETURNING id
        """,
        nome=data['nome'],
        descricao=data.get('descricao', ''),
        link_externo=data.get('link_externo', ''),
        responsavel=data['responsavel'],
        participantes=data.get('participantes', ''),
        data_inicio=data['data_inicio'],
        duracao_dias_uteis=int(data['duracao_dias_uteis']),
        data_fim=data_fim,
        prioridade=data['prioridade'],
        status=data['status']
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
                responsavel = :responsavel, participantes = :participantes,
                data_inicio = :data_inicio, duracao_dias_uteis = :duracao_dias_uteis,
                data_fim = :data_fim, prioridade = :prioridade, status = :status,
                atualizado_em = CURRENT_TIMESTAMP
            WHERE id = :id
        """,
        id=tarefa_id,
        nome=data['nome'],
        descricao=data.get('descricao', ''),
        link_externo=data.get('link_externo', ''),
        responsavel=data['responsavel'],
        participantes=data.get('participantes', ''),
        data_inicio=data['data_inicio'],
        duracao_dias_uteis=int(data['duracao_dias_uteis']),
        data_fim=data_fim,
        prioridade=data['prioridade'],
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
            SELECT nome, descricao, responsavel, participantes, 
                   data_inicio, data_fim, duracao_dias_uteis, prioridade, status
            FROM tarefas
            ORDER BY data_inicio
        """)
        return [{
            'nome': row[0], 'descricao': row[1], 'responsavel': row[2],
            'participantes': row[3], 'data_inicio': row[4], 'data_fim': row[5],
            'duracao_dias_uteis': row[6], 'prioridade': row[7], 'status': row[8]
        } for row in result]
    finally:
        conn.close()

def calcular_data_fim(data_inicio_str, dias_uteis):
    """Calcula a data fim considerando apenas dias úteis (segunda a sexta)"""
    data_inicio = datetime.strptime(data_inicio_str, '%Y-%m-%d')
    data_atual = data_inicio
    dias_contados = 0
    
    while dias_contados < dias_uteis:
        data_atual += timedelta(days=1)
        # 0 = segunda, 1 = terça, ..., 5 = sábado, 6 = domingo
        if data_atual.weekday() < 5:  # 0-4 = dias úteis
            dias_contados += 1
    
    return data_atual.strftime('%Y-%m-%d')