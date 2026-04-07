let tarefas = [];
let currentDate = new Date();
let currentMonth = currentDate.getMonth();
let currentYear = currentDate.getFullYear();
let searchTerm = '';  // <-- ADICIONAR ESTA LINHA

// Filtrar tarefas por nome
function filtrarTarefasPorNome() {
    if (!searchTerm) return tarefas;
    
    return tarefas.filter(tarefa => 
        tarefa.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );
}
// Inicialização
$(document).ready(function() {
    carregarTarefas();
    
    $('#mesAnteriorBtn').click(() => navegarMes(-1));
    $('#proximoMesBtn').click(() => navegarMes(1));

        // ADICIONAR ESTES EVENTOS DE BUSCA
    $('#btnBuscarTarefa').click(function() {
        searchTerm = $('#searchTarefaInput').val();
        renderizarListaTarefas();
        
        // Mostrar botão de limpar se houver busca
        if (searchTerm) {
            $('#btnLimparBusca').show();
        } else {
            $('#btnLimparBusca').hide();
        }
    });
    
    $('#btnLimparBusca').click(function() {
        searchTerm = '';
        $('#searchTarefaInput').val('');
        renderizarListaTarefas();
        $(this).hide();
    });
    
    // Buscar ao pressionar Enter
    $('#searchTarefaInput').on('keypress', function(e) {
        if (e.which === 13) {
            $('#btnBuscarTarefa').click();
        }
    });
    
    
    if (window.userType === 'admin') {
        $('#btnNovaTarefa').click(() => abrirModalTarefa());
        $('#salvarTarefaBtn').click(() => salvarTarefa());
    }
    
    // Botões de expandir
    $('#expandirListaBtn').click(() => toggleExpandir('lista'));
    $('#expandirCalendarioBtn').click(() => toggleExpandir('calendario'));
});

function carregarTarefas() {
    $.get('/api/tarefas', function(data) {
        tarefas = data;
        renderizarListaTarefas();
        renderizarCalendarioGantt();
    });
}

function renderizarListaTarefas() {
    const container = $('#listaTarefas');
    
    // USAR TAREFAS FILTRADAS
    const tarefasFiltradas = filtrarTarefasPorNome();
    
    if (tarefasFiltradas.length === 0) {
        if (searchTerm) {
            container.html('<div class="text-center text-muted mt-5">Nenhuma tarefa encontrada para "' + searchTerm + '"</div>');
        } else {
            container.html('<div class="text-center text-muted mt-5">Nenhuma tarefa cadastrada</div>');
        }
        return;
    }
    
    let html = '<div class="list-group">';
    tarefasFiltradas.forEach(tarefa => {
        const statusClass = getStatusClass(tarefa.status);
        // Destacar o termo buscado no nome da tarefa
        let nomeExibido = escapeHtml(tarefa.nome);
        if (searchTerm) {
            const regex = new RegExp(`(${escapeRegex(searchTerm)})`, 'gi');
            nomeExibido = nomeExibido.replace(regex, '<mark class="bg-warning">$1</mark>');
        }
        
        html += `
            <div class="list-group-item tarefa-item" data-id="${tarefa.id}">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1" onclick="destacarTarefaNoGantt(${tarefa.id})">
                        <h6 class="mb-1">${nomeExibido}</h6>
                        <small class="text-muted">
                            <i class="fas fa-user"></i> ${tarefa.responsavel} |
                            <i class="fas fa-calendar"></i> ${formatDate(tarefa.data_inicio)} a ${formatDate(tarefa.data_fim)} |
                            <span class="badge ${statusClass}">${tarefa.status}</span>
                        </small>
                    </div>
                    ${window.userType === 'admin' ? `
                        <div class="tarefa-acoes">
                            <button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation(); editarTarefa(${tarefa.id})">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); excluirTarefa(${tarefa.id})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    });
    html += '</div>';
    container.html(html);
}

// Nova função para ver detalhes da tarefa
function verDetalhes(tarefaId) {
    const tarefa = tarefas.find(t => t.id === tarefaId);
    if (!tarefa) return;
    
    const html = `
        <div class="mb-3">
            <strong><i class="fas fa-tag"></i> Nome da Tarefa:</strong><br>
            <p class="mt-1">${escapeHtml(tarefa.nome)}</p>
        </div>
        <div class="mb-3">
            <strong><i class="fas fa-align-left"></i> Descrição:</strong><br>
            <p class="mt-1">${escapeHtml(tarefa.descricao || 'Sem descrição')}</p>
        </div>
        <div class="mb-3">
            <strong><i class="fas fa-user-check"></i> Responsável (Principal):</strong><br>
            <p class="mt-1">${escapeHtml(tarefa.responsavel)}</p>
        </div>
        <div class="mb-3">
            <strong><i class="fas fa-users"></i> Participantes:</strong><br>
            <p class="mt-1">${escapeHtml(tarefa.participantes || 'Nenhum')}</p>
        </div>
        <div class="mb-3">
            <strong><i class="fas fa-calendar-alt"></i> Período:</strong><br>
            <p class="mt-1">${formatDate(tarefa.data_inicio)} a ${formatDate(tarefa.data_fim)}</p>
        </div>
        <div class="mb-3">
            <strong><i class="fas fa-chart-line"></i> Status:</strong><br>
            <p class="mt-1"><span class="badge ${getStatusClass(tarefa.status)}">${tarefa.status}</span></p>
        </div>
    `;
    
    $('#detalhesConteudo').html(html);
    $('#modalDetalhes').modal('show');
}

function editarTarefa(tarefaId) {
    const tarefa = tarefas.find(t => t.id === tarefaId);
    if (!tarefa) return;
    
    $('#modalTitulo').text('Editar Tarefa');
    $('#tarefaId').val(tarefa.id);
    $('#nome').val(tarefa.nome);
    $('#descricao').val(tarefa.descricao || '');
    $('#responsavel').val(tarefa.responsavel);
    $('#participantes').val(tarefa.participantes || '');
    $('#data_inicio').val(tarefa.data_inicio);
    $('#duracao').val(tarefa.duracao_dias_uteis);
    $('#prioridade').val(tarefa.prioridade);
    $('#status').val(tarefa.status);
    $('#modalTarefa').modal('show');
}

function salvarTarefa() {
    const tarefaId = $('#tarefaId').val();
    
    // Validar campos obrigatórios
    if (!$('#nome').val() || !$('#descricao').val() || !$('#responsavel').val() || 
        !$('#participantes').val() || !$('#data_inicio').val() || !$('#duracao').val() || 
        !$('#prioridade').val() || !$('#status').val()) {
        alert('Por favor, preencha todos os campos obrigatórios (*)');
        return;
    }
    
    const data = {
        nome: $('#nome').val(),
        descricao: $('#descricao').val(),
        link_externo: '',  // Campo removido, mas mantido para compatibilidade
        responsavel: $('#responsavel').val(),
        participantes: $('#participantes').val(),
        data_inicio: $('#data_inicio').val(),
        duracao_dias_uteis: $('#duracao').val(),
        prioridade: $('#prioridade').val(),
        status: $('#status').val()
    };
    
    const url = tarefaId ? `/api/tarefa/${tarefaId}` : '/api/tarefa';
    const method = tarefaId ? 'PUT' : 'POST';
    
    $.ajax({
        url: url,
        method: method,
        contentType: 'application/json',
        data: JSON.stringify(data),
        success: function() {
            $('#modalTarefa').modal('hide');
            carregarTarefas();
        },
        error: function(xhr) {
            alert('Erro ao salvar tarefa: ' + (xhr.responseJSON?.error || 'Erro desconhecido'));
        }
    });
}

function renderizarCalendarioGantt() {
    if (tarefas.length === 0) {
        $('#calendarioGantt').html('<div class="text-center text-muted mt-5">Nenhuma tarefa para exibir</div>');
        return;
    }
    
    // Filtrar tarefas que intersectam o mês atual
    const inicioMes = new Date(currentYear, currentMonth, 1);
    const fimMes = new Date(currentYear, currentMonth + 1, 0);
    
    // Ajustar para comparar apenas datas (sem hora)
    inicioMes.setHours(0, 0, 0, 0);
    fimMes.setHours(23, 59, 59, 999);
    
    const tarefasMes = tarefas.filter(t => {
        const dataInicio = new Date(t.data_inicio);
        const dataFim = new Date(t.data_fim);
        dataInicio.setHours(0, 0, 0, 0);
        dataFim.setHours(23, 59, 59, 999);
        return (dataInicio <= fimMes && dataFim >= inicioMes);
    });
    
    if (tarefasMes.length === 0) {
        $('#calendarioGantt').html('<div class="text-center text-muted mt-5">Nenhuma tarefa neste mês</div>');
        return;
    }
    
    // Definir largura fixa por dia (em pixels)
    const larguraPorDia = 120; // Aumentado para melhor visualização
    
    // Gerar cabeçalho com dias do mês
    const diasNoMes = getDiasNoMes(currentYear, currentMonth);
    
    let html = `<div class="gantt-container" style="min-width: ${(diasNoMes * larguraPorDia) + 250}px;">
        <div class="gantt-header" style="display: flex; margin-left: 250px;">`;
    
    for (let i = 0; i < diasNoMes; i++) {
        const data = new Date(currentYear, currentMonth, i + 1);
        const isWeekend = data.getDay() === 0 || data.getDay() === 6;
        const isToday = isDataHoje(data);
        const diaSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][data.getDay()];
        
        html += `<div class="gantt-dia" style="width: ${larguraPorDia}px; flex-shrink: 0; text-align: center; padding: 8px 4px; border-left: 1px solid #eee; ${isWeekend ? 'background-color: #f0f0f0;' : ''} ${isToday ? 'background-color: #ffe6b3; font-weight: bold;' : ''}">
                    <div style="font-size: 11px;">${diaSemana}</div>
                    <div><strong>${i + 1}</strong></div>
                </div>`;
    }
    
    html += `</div><div class="gantt-linhas">`;
    
    // Gerar linhas para cada tarefa
    tarefasMes.forEach(tarefa => {
        const dataInicio = new Date(tarefa.data_inicio);
        const dataFim = new Date(tarefa.data_fim);
        
        // Calcular offset em dias desde o início do mês
        let inicioOffset = Math.floor((dataInicio - inicioMes) / (1000 * 60 * 60 * 24));
        
        // Se a tarefa começa antes do mês atual, o offset é 0
        if (inicioOffset < 0) {
            inicioOffset = 0;
        }
        
        // Calcular duração em dias
        const duracao = Math.floor((dataFim - dataInicio) / (1000 * 60 * 60 * 24)) + 1;
        
        // Calcular quantos dias da tarefa estão dentro do mês
        let diasVisiveis = duracao;
        if (inicioOffset + duracao > diasNoMes) {
            diasVisiveis = diasNoMes - inicioOffset;
        }
        
        const leftPos = inicioOffset * larguraPorDia;
        const largura = diasVisiveis * larguraPorDia;
        
        const statusClass = getStatusClass(tarefa.status);
        
        html += `
            <div class="gantt-linha" data-id="${tarefa.id}" style="display: flex; border-bottom: 1px solid #eee; cursor: pointer;" onclick="destacarTarefaNaLista(${tarefa.id})">
                <div class="gantt-tarefa-info" style="width: 250px; padding: 8px; flex-shrink: 0; border-right: 1px solid #ddd;">
                    <strong>${escapeHtml(tarefa.nome)}</strong><br>
                    <small>${tarefa.responsavel} | ${formatDate(tarefa.data_inicio)}</small>
                </div>
                <div class="gantt-barras" style="flex: 1; position: relative; min-height: 60px;">
                    <div class="gantt-barra ${statusClass}" 
                         style="position: absolute; left: ${leftPos}px; width: ${Math.max(largura, 20)}px; height: 30px; border-radius: 4px; padding: 4px 8px; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; top: 15px;"
                         onclick="event.stopPropagation(); destacarTarefaNaLista(${tarefa.id})">
                        ${escapeHtml(tarefa.nome)}
                    </div>
                </div>
            </div>
        `;
    });
    
    html += `</div></div>`;
    $('#calendarioGantt').html(html);
    $('#mesAnoAtual').text(getNomeMes(currentMonth) + ' ' + currentYear);
}
function navegarMes(delta) {
    currentMonth += delta;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    } else if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    renderizarCalendarioGantt();
}

function destacarTarefaNaLista(tarefaId) {
    // Remover destaque anterior
    $('.tarefa-item').removeClass('destacada');
    $(`.tarefa-item[data-id="${tarefaId}"]`).addClass('destacada');
    
    // Rolar até a tarefa
    const element = $(`.tarefa-item[data-id="${tarefaId}"]`);
    if (element.length) {
        $('#listaTarefas').animate({
            scrollTop: element.offset().top - $('#listaTarefas').offset().top + $('#listaTarefas').scrollTop()
        }, 300);
    }
}

function destacarTarefaNoGantt(tarefaId) {
    // Remover destaque anterior
    $('.gantt-linha').removeClass('destacada');
    $(`.gantt-linha[data-id="${tarefaId}"]`).addClass('destacada');
    
    // Rolar até a linha do Gantt
    const element = $(`.gantt-linha[data-id="${tarefaId}"]`);
    if (element.length) {
        $('#calendarioGantt').animate({
            scrollTop: element.offset().top - $('#calendarioGantt').offset().top + $('#calendarioGantt').scrollTop()
        }, 300);
    }
}

function abrirModalTarefa(tarefaId = null) {
    if (tarefaId) {
        $('#modalTitulo').text('Editar Tarefa');
        $.get(`/api/tarefa/${tarefaId}`, function(tarefa) {
            $('#tarefaId').val(tarefa.id);
            $('#nome').val(tarefa.nome);
            $('#descricao').val(tarefa.descricao || '');
            $('#link_externo').val(tarefa.link_externo || '');
            $('#responsavel').val(tarefa.responsavel);
            $('#participantes').val(tarefa.participantes || '');
            $('#data_inicio').val(tarefa.data_inicio);
            $('#duracao').val(tarefa.duracao_dias_uteis);
            $('#prioridade').val(tarefa.prioridade);
            $('#status').val(tarefa.status);
            $('#modalTarefa').modal('show');
        });
    } else {
        $('#modalTitulo').text('Nova Tarefa');
        $('#formTarefa')[0].reset();
        $('#tarefaId').val('');
        $('#modalTarefa').modal('show');
    }
}

function editarTarefa(tarefaId) {
    abrirModalTarefa(tarefaId);
}

function salvarTarefa() {
    const tarefaId = $('#tarefaId').val();
    const data = {
        nome: $('#nome').val(),
        descricao: $('#descricao').val(),
        link_externo: $('#link_externo').val(),
        responsavel: $('#responsavel').val(),
        participantes: $('#participantes').val(),
        data_inicio: $('#data_inicio').val(),
        duracao_dias_uteis: $('#duracao').val(),
        prioridade: $('#prioridade').val(),
        status: $('#status').val()
    };
    
    const url = tarefaId ? `/api/tarefa/${tarefaId}` : '/api/tarefa';
    const method = tarefaId ? 'PUT' : 'POST';
    
    $.ajax({
        url: url,
        method: method,
        contentType: 'application/json',
        data: JSON.stringify(data),
        success: function() {
            $('#modalTarefa').modal('hide');
            carregarTarefas();
        },
        error: function(xhr) {
            alert('Erro ao salvar tarefa: ' + xhr.responseJSON?.error || 'Erro desconhecido');
        }
    });
}

function excluirTarefa(tarefaId) {
    if (confirm('Tem certeza que deseja excluir esta tarefa?')) {
        $.ajax({
            url: `/api/tarefa/${tarefaId}`,
            method: 'DELETE',
            success: function() {
                carregarTarefas();
            },
            error: function(xhr) {
                alert('Erro ao excluir tarefa: ' + xhr.responseJSON?.error || 'Erro desconhecido');
            }
        });
    }
}

function toggleExpandir(tipo) {
    const container = $('#mainLayout');
    if (tipo === 'lista') {
        container.toggleClass('expandido-lista');
        if (container.hasClass('expandido-lista')) {
            container.removeClass('expandido-calendario');
            $('#expandirListaBtn').html('<i class="fas fa-compress-alt"></i> Recolher Lista');
        } else {
            $('#expandirListaBtn').html('<i class="fas fa-expand-alt"></i> Expandir Lista');
        }
    } else {
        container.toggleClass('expandido-calendario');
        if (container.hasClass('expandido-calendario')) {
            container.removeClass('expandido-lista');
            $('#expandirCalendarioBtn').html('<i class="fas fa-compress-alt"></i> Recolher Calendário');
        } else {
            $('#expandirCalendarioBtn').html('<i class="fas fa-expand-alt"></i> Expandir Calendário');
        }
    }
}

// Funções utilitárias
function getStatusClass(status) {
    const mapa = {
        'Atrasado': 'status-atrasado',
        'Concluido': 'status-concluido',
        'Em Andamento': 'status-em-andamento',
        'Nao Iniciado': 'status-nao-iniciado',
        'Pausado': 'status-pausado',
        'Reuniao': 'status-reuniao',
        'Treinamento': 'status-treinamento'
    };
    return mapa[status] || 'status-nao-iniciado';
}

function getDiasNoMes(ano, mes) {
    return new Date(ano, mes + 1, 0).getDate();
}

function getDiferencaDias(data1, data2) {
    return Math.floor((data2 - data1) / (1000 * 60 * 60 * 24));
}

function getNomeMes(mes) {
    const nomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                   'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return nomes[mes];
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

function isDataHoje(data) {
    const hoje = new Date();
    return data.getDate() === hoje.getDate() &&
           data.getMonth() === hoje.getMonth() &&
           data.getFullYear() === hoje.getFullYear();
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}