let tarefas = [];
let currentDate = new Date();
let currentMonth = currentDate.getMonth();
let currentYear = currentDate.getFullYear();
let searchTerm = '';  // <-- ADICIONAR ESTA LINHA

// Função para converter string de data sem fuso horário
function parseDateLocal(dateString) {
    if (!dateString) return null;
    const [ano, mes, dia] = dateString.split('-');
    return new Date(ano, mes - 1, dia);
}

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

    // Evento para quando os checkboxes mudarem
    $(document).on('change', '.equipe-checkbox', function() {
        atualizarEquipesSelecionadas();
    });

    // Clicar fora (no fundo) limpa a seleção
    $(document).on('click', function(event) {
        // Verifica se o clique NÃO foi em uma tarefa, nem na barra do Gantt
        const isTarefa = $(event.target).closest('.tarefa-item').length > 0;
        const isGanttBarra = $(event.target).closest('.gantt-barra').length > 0;
        const isGanttLinha = $(event.target).closest('.gantt-linha').length > 0;
        
        if (!isTarefa && !isGanttBarra && !isGanttLinha) {
            limparDestaque();
        }
    });

    // Evitar que o clique no modal propague para o documento
    $(document).on('click', '.modal, .modal *', function(event) {
        event.stopPropagation();
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
                        <h6 style="margin: 0 0 4px 0;" title="${escapeHtml(tarefa.nome)}">${nomeExibido}</h6>
                        <small class="text-muted">
                            <i class="fas fa-user"></i> ${tarefa.responsavel} |
                            ${tarefa.equipes_envolvidas ? `<i class="fas fa-building"></i> ${escapeHtml(tarefa.equipes_envolvidas)} |` : ''}
                            <i class="fas fa-calendar"></i> ${formatDate(tarefa.data_inicio)} a ${formatDate(tarefa.data_fim)} |
                            <span class="badge ${statusClass}">${tarefa.status}</span>
                        </small>
                    </div>
                    <div class="tarefa-acoes">
                        <button class="btn-detalhes" onclick="event.stopPropagation(); verDetalhes(${tarefa.id})" title="Ver detalhes">
                            <i class="fas fa-info-circle"></i>
                        </button>
                        ${window.userType === 'admin' ? `
                            <button class="btn" onclick="event.stopPropagation(); editarTarefa(${tarefa.id})" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn" onclick="event.stopPropagation(); excluirTarefa(${tarefa.id})" title="Excluir">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : ''}
                    </div>
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
        <div class="mb-3">
            <strong><i class="fas fa-building"></i> Equipes Envolvidas:</strong><br>
            <p class="mt-1">${escapeHtml(tarefa.equipes_envolvidas || 'Nenhuma equipe informada')}</p>
        </div>
        <div><i class="fas fa-tag"></i> Tipo da Tarefa:</strong><br>
            <p style="margin-top: 4px;">
                <span class="badge ${tarefa.tipo_tarefa === 'Reuniao' ? 'status-reuniao' : (tarefa.tipo_tarefa === 'Treinamento' ? 'status-treinamento' : 'status-nao-iniciado')}" style="padding: 6px 12px;">
                    ${tarefa.tipo_tarefa || 'Normal'}
                </span>
            </p>
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
    
    const inicioMes = new Date(currentYear, currentMonth, 1);
    const fimMes = new Date(currentYear, currentMonth + 1, 0);
    inicioMes.setHours(0, 0, 0, 0);
    fimMes.setHours(23, 59, 59, 999);
    
    const tarefasMes = tarefas.filter(t => {
        const dataInicio = parseDateLocal(t.data_inicio);
        const dataFim = parseDateLocal(t.data_fim);
        return (dataInicio <= fimMes && dataFim >= inicioMes);
    });
    
    if (tarefasMes.length === 0) {
        $('#calendarioGantt').html('<div class="text-center text-muted mt-5">Nenhuma tarefa neste mês</div>');
        return;
    }
    
    const larguraColunaInfo = 220;
    const containerCalendario = document.getElementById('calendarioGantt');
    const larguraDisponivel = containerCalendario.clientWidth - larguraColunaInfo - 32;
    const diasNoMes = getDiasNoMes(currentYear, currentMonth);  // ← ÚNICA declaração
    
    let larguraPorDia = Math.floor(larguraDisponivel / diasNoMes);
    larguraPorDia = Math.min(90, Math.max(40, larguraPorDia));  // mínimo 40, máximo 90
    
    // ... resto da função continua igual
    
    let html = `<div class="gantt-container" style="min-width: ${(diasNoMes * larguraPorDia) + larguraColunaInfo}px;">
        <div class="gantt-header" style="display: flex; margin-left: ${larguraColunaInfo}px;">`;
    
    // Cabeçalho dos dias
    for (let i = 0; i < diasNoMes; i++) {
        const data = new Date(currentYear, currentMonth, i + 1);
        const isWeekend = data.getDay() === 0 || data.getDay() === 6;
        const isToday = isDataHoje(data);
        const diaSemana = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][data.getDay()];
        
        html += `<div class="gantt-dia ${isWeekend ? 'weekend' : ''} ${isToday ? 'today' : ''}" style="width: ${larguraPorDia}px; flex-shrink: 0; text-align: center; padding: 6px 2px;">
                    <div style="font-size: 10px;">${diaSemana}</div>
                    <div><strong style="font-size: 11px;">${i + 1}</strong></div>
                </div>`;
    }
    
    html += `</div><div class="gantt-linhas">`;
    
    // Linhas de cada tarefa
    tarefasMes.forEach(tarefa => {
        const dataInicio = parseDateLocal(tarefa.data_inicio);
        const dataFim = parseDateLocal(tarefa.data_fim);
        dataInicio.setHours(0, 0, 0, 0);
        dataFim.setHours(23, 59, 59, 999);
        
        // CÁLCULO CORRIGIDO DO OFFSET
        let inicioOffset = Math.floor((dataInicio - inicioMes) / (1000 * 60 * 60 * 24));
        
        // Se começa antes do mês, posiciona no primeiro dia
        if (inicioOffset < 0) {
            inicioOffset = 0;
        }
        
        // CÁLCULO CORRIGIDO DOS DIAS VISÍVEIS
        // Data final da tarefa, limitada ao último dia do mês
        const fimReal = dataFim < fimMes ? dataFim : fimMes;
        // Data inicial da tarefa, limitada ao primeiro dia do mês
        const inicioReal = dataInicio > inicioMes ? dataInicio : inicioMes;
        
        // Dias visíveis = diferença em dias + 1
        let diasVisiveis = Math.floor((fimReal - inicioReal) / (1000 * 60 * 60 * 24)) + 1;
        
        // Segurança: não pode ultrapassar o mês
        if (inicioOffset + diasVisiveis > diasNoMes) {
            diasVisiveis = diasNoMes - inicioOffset;
        }
        if (diasVisiveis < 0) diasVisiveis = 0;
        
        const leftPos = inicioOffset * larguraPorDia;
        const largura = diasVisiveis * larguraPorDia;
        const statusClass = getStatusClass(tarefa.status);
        
        let nomeTarefa = escapeHtml(tarefa.nome);
        if (nomeTarefa.length > 25) {
            nomeTarefa = nomeTarefa.substring(0, 22) + '...';
        }
        
        html += `
            <div class="gantt-linha" data-id="${tarefa.id}" onclick="destacarTarefaNaLista(${tarefa.id})">
                <div class="gantt-tarefa-info" style="width: ${larguraColunaInfo}px; padding: 8px 10px; flex-shrink: 0; border-right: 1px solid #ddd;">
                    <strong style="font-size: 12px;">${nomeTarefa}</strong><br>
                    <small style="font-size: 10px;">${tarefa.responsavel} | ${formatDate(tarefa.data_inicio)}</small>
                </div>
                <div class="gantt-barras">
                    <div class="gantt-barra ${statusClass}" 
                         style="left: ${leftPos}px; width: ${Math.max(largura, 24)}px; height: 28px; font-size: 10px; padding: 4px 6px; top: 12px;"
                         onclick="event.stopPropagation(); destacarTarefaNaLista(${tarefa.id})">
                        ${nomeTarefa}
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
    // Se a tarefa já está destacada, apenas limpa o destaque (toggle)
    if ($(`.tarefa-item[data-id="${tarefaId}"]`).hasClass('destacada')) {
        limparDestaque();
        return;
    }
    
    // Caso contrário, remove todos e destaca a nova
    limparDestaque();
    
    $('.tarefa-item').removeClass('destacada');
    $('.gantt-linha').removeClass('destacada');
    $('.gantt-barra').removeClass('destacada');
    
    $(`.tarefa-item[data-id="${tarefaId}"]`).addClass('destacada');
    $(`.gantt-linha[data-id="${tarefaId}"]`).addClass('destacada');
    $(`.gantt-linha[data-id="${tarefaId}"] .gantt-barra`).addClass('destacada');
    
    // Rolar até a tarefa na lista
    const element = $(`.tarefa-item[data-id="${tarefaId}"]`);
    if (element.length) {
        $('#listaTarefas').animate({
            scrollTop: element.offset().top - $('#listaTarefas').offset().top + $('#listaTarefas').scrollTop()
        }, 300);
    }
    
    // Rolar até a linha no Gantt
    const ganttElement = $(`.gantt-linha[data-id="${tarefaId}"]`);
    if (ganttElement.length) {
        $('#calendarioGantt').animate({
            scrollTop: ganttElement.offset().top - $('#calendarioGantt').offset().top + $('#calendarioGantt').scrollTop() - 100
        }, 300);
    }
}

function destacarTarefaNoGantt(tarefaId) {
    // Se a tarefa já está destacada, apenas limpa o destaque (toggle)
    if ($(`.gantt-linha[data-id="${tarefaId}"]`).hasClass('destacada')) {
        limparDestaque();
        return;
    }
    
    // Caso contrário, remove todos e destaca a nova
    limparDestaque();
    
    $(`.tarefa-item[data-id="${tarefaId}"]`).addClass('destacada');
    $(`.gantt-linha[data-id="${tarefaId}"]`).addClass('destacada');
    $(`.gantt-linha[data-id="${tarefaId}"] .gantt-barra`).addClass('destacada');
    
    // Rolar até a linha no Gantt
    const element = $(`.gantt-linha[data-id="${tarefaId}"]`);
    if (element.length) {
        $('#calendarioGantt').animate({
            scrollTop: element.offset().top - $('#calendarioGantt').offset().top + $('#calendarioGantt').scrollTop() - 100
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
            carregarEquipesNoFormulario(tarefa.equipes_envolvidas || '');
            $('#data_inicio').val(tarefa.data_inicio);
            $('#duracao').val(tarefa.duracao_dias_uteis);
            $('#prioridade').val(tarefa.prioridade);
            $('#tipo_tarefa').val(tarefa.tipo_tarefa || 'Normal');
            $('#status').val(tarefa.status);
            $('#modalTarefa').modal('show');
        });
    } else {
        $('#modalTitulo').text('Nova Tarefa');
        $('#formTarefa')[0].reset();
        $('#tarefaId').val('');
        // Limpar checkboxes ao criar nova tarefa
        $('.equipe-checkbox').prop('checked', false);
        $('#equipes_envolvidas').val('');
        $('#modalTarefa').modal('show');
    }
}

function editarTarefa(tarefaId) {
    console.log('Editando tarefa via array local:', tarefaId);
    
    // Buscar a tarefa no array local (já carregado)
    const tarefa = tarefas.find(t => t.id === tarefaId);
    
    if (!tarefa) {
        console.error('Tarefa não encontrada no array local');
        alert('Erro: Tarefa não encontrada!');
        return;
    }
    
    // Preencher o formulário com os dados do array local
    $('#modalTitulo').text('Editar Tarefa');
    $('#tarefaId').val(tarefa.id);
    $('#nome').val(tarefa.nome);
    $('#descricao').val(tarefa.descricao || '');
    $('#link_externo').val(tarefa.link_externo || '');
    $('#responsavel').val(tarefa.responsavel);
    $('#participantes').val(tarefa.participantes || '');
    carregarEquipesNoFormulario(tarefa.equipes_envolvidas || '');
    $('#data_inicio').val(tarefa.data_inicio);
    $('#duracao').val(tarefa.duracao_dias_uteis);
    $('#prioridade').val(tarefa.prioridade);
    $('#status').val(tarefa.status);
    
    // Abrir o modal
    $('#modalTarefa').modal('show');
}

function salvarTarefa() {
    const tarefaId = $('#tarefaId').val();
    const data = {
        nome: $('#nome').val(),
        descricao: $('#descricao').val(),
        link_externo: $('#link_externo').val(),
        responsavel: $('#responsavel').val(),
        participantes: $('#participantes').val(),
        equipes_envolvidas: $('#equipes_envolvidas').val(),  // ← NOVO
        data_inicio: $('#data_inicio').val(),
        duracao_dias_uteis: $('#duracao').val(),
        prioridade: $('#prioridade').val(),
        tipo_tarefa: $('#tipo_tarefa').val(),
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
    // Parse manual para evitar problemas de fuso horário
    const [ano, mes, dia] = dateString.split('-');
    return `${dia}/${mes}/${ano}`;
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

// Atualizar o campo hidden com as equipes selecionadas
function atualizarEquipesSelecionadas() {
    const selecionadas = [];
    $('.equipe-checkbox:checked').each(function() {
        selecionadas.push($(this).val());
    });
    $('#equipes_envolvidas').val(selecionadas.join(', '));
}

// Carregar as equipes selecionadas no formulário
function carregarEquipesNoFormulario(equipesString) {
    // Limpar todos os checkboxes
    $('.equipe-checkbox').prop('checked', false);
    
    if (equipesString) {
        const equipesArray = equipesString.split(',').map(e => e.trim());
        $('.equipe-checkbox').each(function() {
            if (equipesArray.includes($(this).val())) {
                $(this).prop('checked', true);
            }
        });
    }
    atualizarEquipesSelecionadas();
}

function limparDestaque() {
    $('.tarefa-item').removeClass('destacada');
    $('.gantt-linha').removeClass('destacada');
    $('.gantt-barra').removeClass('destacada');
}