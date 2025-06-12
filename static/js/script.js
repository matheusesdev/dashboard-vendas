// static/js/script.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Variáveis de Estado ---
    let fullData = [];
    let filteredData = [];
    let charts = {};

    // --- Seleção de Elementos da UI ---
    const form = document.getElementById('uploadForm');
    const btnGerar = document.getElementById('btnGerar');
    const spinner = document.getElementById('spinner');
    const dashboardContainer = document.getElementById('dashboard-container');
    const filterSelect = document.getElementById('empreendimento-filter');
    const btnDownloadXlsx = document.getElementById('btnDownloadXlsx');
    const btnDownloadPdf = document.getElementById('btnDownloadPdf');
    const loadingOverlay = document.getElementById('loading-overlay');
    const estoqueFileInput = document.getElementById('estoqueFile');
    const vendasFileInput = document.getElementById('vendasFile');
    const estoqueFileName = document.getElementById('estoqueFileName');
    const vendasFileName = document.getElementById('vendasFileName');
    const analiseDetalhadaFilter = document.getElementById('analise-detalhada-filter');
    
    // --- Funções Utilitárias ---
    const checkFormState = () => btnGerar.disabled = !(estoqueFileInput.files.length > 0 && vendasFileInput.files.length > 0);
    
    const updateFileDisplay = (input, nameDisplay) => {
        const file = input.files[0];
        const group = input.closest('.file-input-group');
        if (file) {
            nameDisplay.textContent = file.name;
            group.classList.add('filled');
        } else {
            nameDisplay.textContent = "Nenhum arquivo";
            group.classList.remove('filled');
        }
        checkFormState();
    };
    
    const showToast = (message, type = 'success') => {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="material-icons">${type === 'success' ? 'check_circle' : 'error'}</i> ${message}`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.5s forwards';
            toast.addEventListener('animationend', () => toast.remove());
        }, 5000);
    };
    
    const formatCurrency = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

    const showChartMessage = (chartSelector, message) => {
        const el = document.querySelector(chartSelector);
        el.innerHTML = `<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">${message}</p>`;
    };
    
    const getBaseChartOptions = () => ({
        theme: { mode: 'light' },
        chart: {
            fontFamily: 'Inter, sans-serif',
            foreColor: '#6c757d',
            toolbar: { show: false }
        },
        grid: { borderColor: '#e9ecef', strokeDashArray: 3 },
        tooltip: { theme: 'light' },
        dataLabels: { enabled: false },
        legend: { fontWeight: 500, labels: { colors: '#212529' } },
        xaxis: { labels: { style: { fontWeight: 500 } } }
    });

    // --- Lógica de Renderização ---
    const renderDashboard = (data) => {
        Object.values(charts).forEach(chart => chart?.destroy());
        charts = {};
        
        document.querySelector("#chart-vendas-empreendimento").innerHTML = '';
        document.querySelector("#chart-unidades-tipologia").innerHTML = '';
        document.querySelector("#chart-vendas-etapa").innerHTML = '';
        document.querySelector("#analise-detalhada-body").innerHTML = '';
        
        if (!data || data.length === 0) { showToast("Nenhum dado para exibir para este filtro.", "error"); return; }
        filteredData = data;
        
        renderKPIs(data);
        renderVendasChart(data);
        renderTipologiaChart(data);
        renderVendasPorEtapaChart(data);
        renderAnaliseDetalhadaTable(data);
    };

    const renderKPIs = (data) => {
        const SITUACAO_VENDIDO = ['VENDIDO', 'VENDIDA'];
        const statusCounts = data.reduce((acc, d) => {
            const situacao = (d.situacao || 'INDEFINIDO').toUpperCase().trim();
            acc[situacao] = (acc[situacao] || 0) + 1;
            return acc;
        }, {});
        const vendidasCount = SITUACAO_VENDIDO.reduce((sum, s) => sum + (statusCounts[s] || 0), 0);
        const vgvTotal = data
            .filter(d => SITUACAO_VENDIDO.includes((d.situacao || '').toUpperCase().trim()))
            .reduce((sum, d) => sum + (d.valorContrato || 0), 0);
        
        document.getElementById('kpi-vendidas').textContent = vendidasCount;
        document.getElementById('kpi-reservadas').textContent = statusCounts['RESERVADA'] || 0;
        document.getElementById('kpi-disponiveis').textContent = statusCounts['DISPONÍVEL'] || statusCounts['DISPONIVEL'] || 0;
        document.getElementById('kpi-bloqueadas').textContent = statusCounts['BLOQUEADA'] || statusCounts['BLOQUEADO'] || 0;
        document.getElementById('kpi-vgv').textContent = formatCurrency(vgvTotal);
    };
    
    const renderVendasChart = (data) => {
        const container = "#chart-vendas-empreendimento";
        const titleElement = document.getElementById('vendas-empreendimento-title');
        const filterValue = filterSelect.value;
        const baseOptions = getBaseChartOptions();
        try {
            const vendasData = data.filter(d => ['VENDIDO', 'VENDIDA'].includes((d.situacao || '').toUpperCase()) && d.tipoVenda);
            if (vendasData.length === 0) { showChartMessage(container, "Sem dados de 'Tipo de Venda' para este filtro."); return; }
            if (filterValue === 'todos') {
                titleElement.textContent = 'Tipos de Venda por Empreendimento';
                const grouped = vendasData.reduce((acc, d) => { acc[d.empreendimento] = acc[d.empreendimento] || {}; acc[d.empreendimento][d.tipoVenda] = (acc[d.empreendimento][d.tipoVenda] || 0) + 1; return acc; }, {});
                const empreendimentos = Object.keys(grouped);
                const tiposDeVenda = [...new Set(vendasData.map(d => d.tipoVenda))];
                const series = tiposDeVenda.map(tipo => ({ name: tipo, data: empreendimentos.map(emp => grouped[emp][tipo] || 0) }));
                charts.vendas = new ApexCharts(document.querySelector(container), { ...baseOptions, series, chart: { ...baseOptions.chart, type: 'bar', height: 350, stacked: true }, plotOptions: { bar: { horizontal: true } }, xaxis: { categories: empreendimentos }, legend: { ...baseOptions.legend, position: 'top' } });
                charts.vendas.render();
            } else {
                titleElement.textContent = `Tipos de Venda para ${filterValue}`;
                const groupedByTipo = vendasData.reduce((acc, d) => { acc[d.tipoVenda] = (acc[d.tipoVenda] || 0) + 1; return acc; }, {});
                const labels = Object.keys(groupedByTipo);
                const series = Object.values(groupedByTipo);
                charts.vendas = new ApexCharts(document.querySelector(container), { ...baseOptions, series, labels, chart: { ...baseOptions.chart, type: 'donut', height: 350 }, legend: { ...baseOptions.legend, position: 'bottom' } });
                charts.vendas.render();
            }
        } catch (err) { console.error("Erro no gráfico de vendas:", err); showChartMessage(container, "Erro ao processar dados."); }
    };
    
    const renderTipologiaChart = (data) => {
        const container = "#chart-unidades-tipologia";
        const baseOptions = getBaseChartOptions();
        try {
            const tipologiaData = data.filter(d => d.tipologia);
            if (tipologiaData.length === 0) { showChartMessage(container, "Sem dados de 'Tipologia' para este filtro."); return; }
            const grouped = tipologiaData.reduce((acc, d) => { acc[d.tipologia] = (acc[d.tipologia] || 0) + 1; return acc; }, {});
            const sorted = Object.entries(grouped).sort((a,b) => b[1] - a[1]);
            charts.tipologia = new ApexCharts(document.querySelector(container), { ...baseOptions, series: [{ name: 'Unidades', data: sorted.map(d => d[1]) }], chart: { ...baseOptions.chart, type: 'bar', height: 350 }, plotOptions: { bar: { horizontal: false, distributed: true, columnWidth: '60%' } }, xaxis: { categories: sorted.map(d => d[0]) }, legend: { show: false } });
            charts.tipologia.render();
        } catch (err) { console.error("Erro no gráfico de tipologia:", err); showChartMessage(container, "Erro ao processar dados."); }
    };
    
    const renderVendasPorEtapaChart = (data) => {
        const container = "#chart-vendas-etapa";
        const baseOptions = getBaseChartOptions();
        try {
            const SITUACAO_VENDIDO = ['VENDIDO', 'VENDIDA'];
            const vendasData = data.filter(d => SITUACAO_VENDIDO.includes((d.situacao || '').toUpperCase()) && d.etapa);
            if (vendasData.length === 0) { showChartMessage(container, "Sem dados de vendas por etapa para este filtro."); return; }
            const grouped = vendasData.reduce((acc, d) => { acc[d.etapa] = (acc[d.etapa] || 0) + 1; return acc; }, {});
            const sorted = Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
            charts.vendasEtapa = new ApexCharts(document.querySelector(container), { ...baseOptions, series: [{ name: 'Vendas', data: sorted.map(d => d[1]) }], chart: { ...baseOptions.chart, type: 'bar', height: 350 }, plotOptions: { bar: { horizontal: false, columnWidth: '50%', distributed: true } }, xaxis: { categories: sorted.map(d => d[0]) }, legend: { show: false } });
            charts.vendasEtapa.render();
        } catch (err) { console.error("Erro no gráfico de etapa:", err); showChartMessage(container, "Erro ao processar dados."); }
    };

    const renderAnaliseDetalhadaTable = (data) => {
        const tableBody = document.getElementById('analise-detalhada-body');
        const headerCell = document.getElementById('analise-detalhada-header');
        const groupByKey = analiseDetalhadaFilter.value;
        const selectedOption = analiseDetalhadaFilter.options[analiseDetalhadaFilter.selectedIndex];
        headerCell.textContent = selectedOption.textContent;
        const SITUACAO_VENDIDO = ['VENDIDO', 'VENDIDA'];
        try {
            const grouped = data.reduce((acc, d) => {
                const key = d[groupByKey] || 'Não especificado';
                if (!acc[key]) { acc[key] = { vendidas: 0, vgvVendido: 0, reservadas: 0, disponiveis: 0, bloqueadas: 0, outros: 0 }; }
                const situacao = (d.situacao || '').toUpperCase();
                if (SITUACAO_VENDIDO.includes(situacao)) { acc[key].vendidas++; acc[key].vgvVendido += d.valorContrato || 0; }
                else if (situacao === 'RESERVADA') { acc[key].reservadas++; }
                else if (situacao === 'DISPONÍVEL' || situacao === 'DISPONIVEL') { acc[key].disponiveis++; }
                else if (situacao === 'BLOQUEADA' || situacao === 'BLOQUEADO') { acc[key].bloqueadas++; }
                else { acc[key].outros++; }
                return acc;
            }, {});
            const analysis = Object.entries(grouped).map(([key, counts]) => {
                const precoMedio = counts.vendidas > 0 ? counts.vgvVendido / counts.vendidas : 0;
                return { key, ...counts, total: counts.vendidas + counts.reservadas + counts.disponiveis + counts.bloqueadas + counts.outros, precoMedio: precoMedio }
            }).sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
            if (analysis.length === 0) { tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;">Nenhum dado para este agrupamento.</td></tr>`; return; }
            tableBody.innerHTML = analysis.map(row => `<tr><td>${row.key}</td><td>${row.vendidas}</td><td>${row.reservadas}</td><td>${row.disponiveis}</td><td>${row.bloqueadas}</td><td>${row.outros}</td><td>${row.total}</td><td class="text-right">${row.precoMedio > 0 ? formatCurrency(row.precoMedio) : '-'}</td></tr>`).join('');
        } catch (err) { console.error("Erro na tabela detalhada:", err); tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Erro ao processar dados.</td></tr>'; }
    };

    // --- Lógica de Eventos ---
    form.addEventListener('submit', async e => {
        e.preventDefault();
        if (btnGerar.disabled) return;
        btnGerar.disabled = true; spinner.hidden = false;
        dashboardContainer.classList.add('hidden');
        try {
            const response = await fetch('/processar', { method: 'POST', body: new FormData(form) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Erro desconhecido no servidor.");
            fullData = data.table_data;
            if (!fullData || fullData.length === 0) throw new Error("Os arquivos processados não retornaram dados válidos.");
            filterSelect.innerHTML = '<option value="todos">Todos os Empreendimentos</option>';
            data.empreendimentos.forEach(emp => {
                const option = document.createElement('option');
                option.value = emp; option.textContent = emp;
                filterSelect.appendChild(option);
            });
            renderDashboard(fullData);
            dashboardContainer.classList.remove('hidden');
            setTimeout(() => { dashboardContainer.scrollIntoView(); }, 10);
            showToast("Análise concluída com sucesso!");
        } catch (error) { showToast(error.message, 'error');
        } finally { btnGerar.disabled = false; spinner.hidden = true; }
    });

    filterSelect.addEventListener('change', (e) => {
        const selectedValue = e.target.value;
        const dataToRender = selectedValue === 'todos' ? fullData : fullData.filter(item => item.empreendimento === selectedValue);
        renderDashboard(dataToRender);
    });

    analiseDetalhadaFilter.addEventListener('change', () => renderAnaliseDetalhadaTable(filteredData));

    btnDownloadXlsx.addEventListener('click', async () => {
        if (filteredData.length === 0) { showToast("Gere um dashboard antes de baixar.", 'error'); return; }
        loadingOverlay.classList.remove('hidden');
        try {
            const response = await fetch('/download-xlsx', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(filteredData) });
            if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Erro no servidor.'); }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a'); a.style.display = 'none'; a.href = url;
            a.download = `relatorio_consolidado_${new Date().toISOString().slice(0,10)}.xlsx`;
            document.body.appendChild(a); a.click();
            window.URL.revokeObjectURL(url); document.body.removeChild(a);
        } catch (error) { showToast(error.message, 'error');
        } finally { loadingOverlay.classList.add('hidden'); }
    });

    btnDownloadPdf.addEventListener('click', () => {
        if (filteredData.length === 0) { showToast("Gere um dashboard antes de gerar o PDF.", 'error'); return; }
        loadingOverlay.classList.remove('hidden');
        const dashboardElement = document.getElementById('dashboard-container');
        dashboardElement.classList.add('pdf-capture');

        html2canvas(dashboardElement, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
        .then(canvas => {
            dashboardElement.classList.remove('pdf-capture');
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
            
            // --- Página 1: Capa com a Imagem do Dashboard ---
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const ratio = canvas.width / canvas.height;
            let newWidth = pdfWidth - 80; // Margens
            let newHeight = newWidth / ratio;
            if (newHeight > pdfHeight - 80) {
                newHeight = pdfHeight - 80;
                newWidth = newHeight * ratio;
            }
            const x = (pdfWidth - newWidth) / 2;
            const y = 40;
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, newWidth, newHeight);
            const filterText = filterSelect.options[filterSelect.selectedIndex].text;
            pdf.setFontSize(10);
            pdf.setTextColor('#6c757d');
            pdf.text(`Relatório de Vendas | Filtro: ${filterText} | Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 40, 20);

            // --- Páginas Seguintes com Tabelas de Dados ---
            if (charts.vendas) {
                pdf.addPage();
                const title = document.getElementById('vendas-empreendimento-title').textContent;
                const head = [[]];
                const body = [];
                if (charts.vendas.w.config.chart.type === 'donut') {
                    head[0] = ['Tipo de Venda', 'Quantidade'];
                    charts.vendas.w.config.labels.forEach((label, i) => {
                        body.push([label, charts.vendas.w.config.series[i]]);
                    });
                } else {
                    head[0] = ['Empreendimento', ...charts.vendas.w.config.series.map(s => s.name)];
                    charts.vendas.w.config.xaxis.categories.forEach((cat, i) => {
                        body.push([cat, ...charts.vendas.w.config.series.map(s => s.data[i])]);
                    });
                }
                pdf.autoTable({ head, body, startY: 60, didDrawPage: data => pdf.text(title, 40, 40) });
            }
            if (charts.tipologia) {
                pdf.addPage();
                const head = [['Tipologia', 'Total de Unidades']];
                const body = charts.tipologia.w.config.xaxis.categories.map((cat, i) => [cat, charts.tipologia.w.config.series[0].data[i]]);
                pdf.autoTable({ head, body, startY: 60, didDrawPage: data => pdf.text('Unidades por Tipologia', 40, 40) });
            }
            if (charts.vendasEtapa) {
                pdf.addPage();
                const head = [['Etapa', 'Unidades Vendidas']];
                const body = charts.vendasEtapa.w.config.xaxis.categories.map((cat, i) => [cat, charts.vendasEtapa.w.config.series[0].data[i]]);
                pdf.autoTable({ head, body, startY: 60, didDrawPage: data => pdf.text('Vendas por Etapa', 40, 40) });
            }
            pdf.addPage();
            const tableElement = document.getElementById('analise-detalhada-table');
            pdf.autoTable({ html: tableElement, startY: 60, didDrawPage: data => pdf.text('Análise Detalhada de Status', 40, 40) });

            pdf.save(`dashboard_vendas_${new Date().toISOString().slice(0,10)}.pdf`);
        }).catch(err => {
            console.error("Erro ao gerar PDF:", err);
            showToast("Falha ao gerar o PDF.", "error");
        }).finally(() => {
            dashboardElement.classList.remove('pdf-capture');
            loadingOverlay.classList.add('hidden');
        });
    });
    
    estoqueFileInput.addEventListener('change', () => updateFileDisplay(estoqueFileInput, estoqueFileName));
    vendasFileInput.addEventListener('change', () => updateFileDisplay(vendasFileInput, vendasFileName));
    checkFormState();
});