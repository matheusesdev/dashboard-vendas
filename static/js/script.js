// static/js/script.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Variáveis de Estado ---
    let fullData = [];
    let filteredData = [];
    let charts = {};
    let currentTheme = localStorage.getItem('theme') || 'light';

    // --- Seleção de Elementos da UI ---
    const body = document.body;
    const form = document.getElementById('uploadForm');
    const btnGerar = document.getElementById('btnGerar');
    const spinner = document.getElementById('spinner');
    const dashboardContainer = document.getElementById('dashboard-container');
    const customSelectWrapper = document.getElementById('custom-select-wrapper');
    const btnDownloadXlsx = document.getElementById('btnDownloadXlsx');
    const btnDownloadPdf = document.getElementById('btnDownloadPdf');
    const loadingOverlay = document.getElementById('loading-overlay');
    const estoqueFileInput = document.getElementById('estoqueFile');
    const vendasFileInput = document.getElementById('vendasFile');
    const estoqueFileName = document.getElementById('estoqueFileName');
    const vendasFileName = document.getElementById('vendasFileName');
    const analiseDetalhadaFilter = document.getElementById('analise-detalhada-filter');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const lightThemeToggle = document.getElementById('light-theme');
    const darkThemeToggle = document.getElementById('dark-theme');

    // --- Funções Utilitárias ---
    const checkFormState = () => btnGerar.disabled = !(estoqueFileInput.files.length > 0 && vendasFileInput.files.length > 0);
    
    const updateFileDisplay = (input, buttonDisplay) => {
        const file = input.files[0];
        const group = input.closest('.file-input-group');
        if (file) {
            buttonDisplay.textContent = file.name;
            group.classList.add('filled');
        } else {
            buttonDisplay.textContent = "Selecionar arquivo";
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
    
    const showChartMessage = (chartSelector, message) => {
        const el = document.querySelector(chartSelector);
        if (el) el.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; color: var(--text-secondary); padding: 2rem;">${message}</div>`;
    };

    const animateValue = (element, start, end, duration) => {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            element.innerText = Math.floor(progress * (end - start) + start).toLocaleString('pt-BR');
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    };
    
    const getBaseChartOptions = () => ({
        theme: { mode: currentTheme },
        chart: {
            fontFamily: 'Inter, sans-serif',
            foreColor: 'var(--text-secondary)',
            background: 'transparent',
            toolbar: { show: true, tools: { download: '<i class="material-icons" style="color:var(--text-secondary)">vertical_align_bottom</i>' } }
        },
        grid: { borderColor: 'var(--border-color)', strokeDashArray: 3 },
        tooltip: { theme: currentTheme },
        dataLabels: { enabled: false },
        legend: { fontWeight: 500, labels: { colors: 'var(--text-primary)' } },
        xaxis: { labels: { style: { colors: 'var(--text-secondary)', fontWeight: 500 } } },
        yaxis: { labels: { style: { colors: 'var(--text-secondary)' } } }
    });
    
    // --- Lógica do Dropdown Customizado ---
    const createCustomDropdown = (originalSelect) => {
        originalSelect.style.display = 'none';

        const container = document.createElement('div');
        container.className = 'custom-select-container';

        const trigger = document.createElement('div');
        trigger.className = 'custom-select-trigger';
        trigger.textContent = originalSelect.options[originalSelect.selectedIndex].textContent;
        container.appendChild(trigger);
        
        const options = document.createElement('div');
        options.className = 'custom-options';

        Array.from(originalSelect.options).forEach(optionEl => {
            const customOption = document.createElement('div');
            customOption.className = 'custom-option';
            customOption.textContent = optionEl.textContent;
            customOption.dataset.value = optionEl.value;

            if (optionEl.selected) {
                customOption.classList.add('selected');
            }

            customOption.addEventListener('click', () => {
                options.querySelector('.selected')?.classList.remove('selected');
                customOption.classList.add('selected');
                trigger.textContent = customOption.textContent;
                container.classList.remove('open');
                if (originalSelect.value !== customOption.dataset.value) {
                    originalSelect.value = customOption.dataset.value;
                    originalSelect.dispatchEvent(new Event('change'));
                }
            });

            options.appendChild(customOption);
        });

        container.appendChild(options);
        customSelectWrapper.innerHTML = '';
        customSelectWrapper.appendChild(container);

        trigger.addEventListener('click', () => {
            container.classList.toggle('open');
        });

        window.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                container.classList.remove('open');
            }
        });
    };

    // --- Lógica de Renderização ---
    const renderDashboard = (data) => {
        Object.values(charts).forEach(chart => chart?.destroy());
        charts = {};
        
        document.querySelector("#chart-vendas-empreendimento").innerHTML = '';
        document.querySelector("#chart-unidades-tipologia").innerHTML = '';
        document.querySelector("#chart-vendas-etapa").innerHTML = '';
        document.querySelector("#chart-vendas-mes").innerHTML = '';
        
        if (!data || data.length === 0) {
            showToast("Nenhum dado para exibir para este filtro.", "error");
            renderKPIs([]);
            return;
        }
        filteredData = data;
        
        renderKPIs(data);
        renderVendasChart(data);
        renderTipologiaChart(data);
        renderVendasPorEtapaChart(data);
        renderVendasPorMesChart(data);
        renderAnaliseDetalhadaTable(data);
    };

    const renderKPIs = (data) => {
        const SITUACAO_VENDIDO = ['VENDIDO', 'VENDIDA'];
        let statusCounts = {}, vendidasCount = 0;

        if (data.length > 0) {
            statusCounts = data.reduce((acc, d) => {
                const situacao = (d.situacao || 'INDEFINIDO').toUpperCase().trim();
                acc[situacao] = (acc[situacao] || 0) + 1;
                return acc;
            }, {});
            vendidasCount = SITUACAO_VENDIDO.reduce((sum, s) => sum + (statusCounts[s] || 0), 0);
        }

        animateValue(document.getElementById('kpi-vendidas'), 0, vendidasCount, 1000);
        animateValue(document.getElementById('kpi-reservadas'), 0, statusCounts['RESERVADA'] || 0, 1000);
        animateValue(document.getElementById('kpi-disponiveis'), 0, statusCounts['DISPONÍVEL'] || statusCounts['DISPONIVEL'] || 0, 1000);
        animateValue(document.getElementById('kpi-bloqueadas'), 0, statusCounts['BLOQUEADA'] || statusCounts['BLOQUEADO'] || 0, 1000);
    };
    
    const renderVendasChart = (data) => {
        const container = "#chart-vendas-empreendimento";
        const titleElement = document.getElementById('vendas-empreendimento-title');
        const filterValue = document.querySelector('.custom-select-trigger').textContent;
        const baseOptions = getBaseChartOptions();
        try {
            const vendasData = data.filter(d => ['VENDIDO', 'VENDIDA'].includes((d.situacao || '').toUpperCase()) && d.tipoVenda);
            if (vendasData.length === 0) { showChartMessage(container, "Sem dados de 'Tipo de Venda'."); return; }
            if (filterValue === 'Todos os Empreendimentos') {
                titleElement.textContent = 'Tipos de Venda por Empreendimento';
                const grouped = vendasData.reduce((acc, d) => { acc[d.empreendimento] = acc[d.empreendimento] || {}; acc[d.empreendimento][d.tipoVenda] = (acc[d.empreendimento][d.tipoVenda] || 0) + 1; return acc; }, {});
                const empreendimentos = Object.keys(grouped);
                const tiposDeVenda = [...new Set(vendasData.map(d => d.tipoVenda))];
                const series = tiposDeVenda.map(tipo => ({ name: tipo, data: empreendimentos.map(emp => grouped[emp][tipo] || 0) }));
                charts.vendas = new ApexCharts(document.querySelector(container), { ...baseOptions, series, chart: { ...baseOptions.chart, type: 'bar', height: 350, stacked: true }, plotOptions: { bar: { horizontal: true } }, xaxis: { categories: empreendimentos, ...baseOptions.xaxis }, legend: { ...baseOptions.legend, position: 'top' } });
            } else {
                titleElement.textContent = `Tipos de Venda para ${filterValue}`;
                const groupedByTipo = vendasData.reduce((acc, d) => { acc[d.tipoVenda] = (acc[d.tipoVenda] || 0) + 1; return acc; }, {});
                const labels = Object.keys(groupedByTipo);
                const series = Object.values(groupedByTipo);
                charts.vendas = new ApexCharts(document.querySelector(container), { ...baseOptions, series, labels, chart: { ...baseOptions.chart, type: 'donut', height: 350 }, legend: { ...baseOptions.legend, position: 'bottom' } });
            }
            charts.vendas.render();
        } catch (err) { console.error("Erro no gráfico de vendas:", err); showChartMessage(container, "Erro ao processar dados."); }
    };
    
    const renderTipologiaChart = (data) => {
        const container = "#chart-unidades-tipologia";
        const baseOptions = getBaseChartOptions();
        try {
            const tipologiaData = data.filter(d => d.tipologia);
            if (tipologiaData.length === 0) { showChartMessage(container, "Sem dados de 'Tipologia'."); return; }
            const grouped = tipologiaData.reduce((acc, d) => { acc[d.tipologia] = (acc[d.tipologia] || 0) + 1; return acc; }, {});
            const sorted = Object.entries(grouped).sort((a,b) => b[1] - a[1]);
            charts.tipologia = new ApexCharts(document.querySelector(container), { ...baseOptions, series: [{ name: 'Unidades', data: sorted.map(d => d[1]) }], chart: { ...baseOptions.chart, type: 'bar', height: 350 }, plotOptions: { bar: { horizontal: false, distributed: true, columnWidth: '60%' } }, xaxis: { categories: sorted.map(d => d[0]), ...baseOptions.xaxis }, legend: { show: false } });
            charts.tipologia.render();
        } catch (err) { console.error("Erro no gráfico de tipologia:", err); showChartMessage(container, "Erro ao processar dados."); }
    };
    
    const renderVendasPorEtapaChart = (data) => {
        const container = "#chart-vendas-etapa";
        const baseOptions = getBaseChartOptions();
        try {
            const SITUACAO_VENDIDO = ['VENDIDO', 'VENDIDA'];
            const vendasData = data.filter(d => SITUACAO_VENDIDO.includes((d.situacao || '').toUpperCase()) && d.etapa);
            if (vendasData.length === 0) { showChartMessage(container, "Sem dados de vendas por etapa."); return; }
            const grouped = vendasData.reduce((acc, d) => { acc[d.etapa] = (acc[d.etapa] || 0) + 1; return acc; }, {});
            const sorted = Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
            charts.vendasEtapa = new ApexCharts(document.querySelector(container), { ...baseOptions, series: [{ name: 'Vendas', data: sorted.map(d => d[1]) }], chart: { ...baseOptions.chart, type: 'bar', height: 350 }, plotOptions: { bar: { horizontal: false, columnWidth: '50%', distributed: true } }, xaxis: { categories: sorted.map(d => d[0]), ...baseOptions.xaxis }, legend: { show: false } });
            charts.vendasEtapa.render();
        } catch (err) { console.error("Erro no gráfico de etapa:", err); showChartMessage(container, "Erro ao processar dados."); }
    };
    
    const renderVendasPorMesChart = (data) => {
        const container = "#chart-vendas-mes";
        const baseOptions = getBaseChartOptions();
        try {
            const SITUACAO_VENDIDO = ['VENDIDO', 'VENDIDA'];
            const vendasData = data.filter(d => SITUACAO_VENDIDO.includes((d.situacao || '').toUpperCase().trim()) && d.dataVenda);
            if (vendasData.length === 0) { showChartMessage(container, "Nenhuma data de venda encontrada."); return; }
            const monthlyCounts = vendasData.reduce((acc, item) => {
                try {
                    const parts = item.dataVenda.split('/');
                    if (parts.length === 3) {
                        const month = parts[1].padStart(2, '0');
                        const year = parts[2];
                        const key = `${year}-${month}`;
                        acc[key] = (acc[key] || 0) + 1;
                    }
                } catch (e) { console.warn("Formato de data inválido:", item.dataVenda); }
                return acc;
            }, {});

            const sortedKeys = Object.keys(monthlyCounts).sort();
            const seriesData = sortedKeys.map(key => monthlyCounts[key]);
            const categories = sortedKeys.map(key => { const [year, month] = key.split('-'); return `${month}/${year}`; });

            charts.vendasMes = new ApexCharts(document.querySelector(container), { ...baseOptions, series: [{ name: 'Vendas', data: seriesData }], chart: { ...baseOptions.chart, type: 'area', height: 350, }, colors: [baseOptions.theme.mode === 'dark' ? '#6366f1' : '#4f46e5'], xaxis: { categories: categories, ...baseOptions.xaxis, tickAmount: 10 }, stroke: { curve: 'smooth', width: 3 }, markers: { size: 5 }, legend: { show: false } });
            charts.vendasMes.render();
        } catch (err) { console.error("Erro no gráfico de vendas por mês:", err); showChartMessage(container, "Erro ao processar dados."); }
    };
    
    const renderAnaliseDetalhadaTable = (data) => {
        const tableThead = document.querySelector('#analise-detalhada-table thead');
        const tableBody = document.getElementById('analise-detalhada-body');
        const groupByKey = analiseDetalhadaFilter.value;

        tableThead.innerHTML = '';
        tableBody.innerHTML = '';

        try {
            if (groupByKey === 'tipologiaPorEtapa') {
                const allTypologies = [...new Set(data.map(d => d.tipologia).filter(Boolean))].sort();
                
                let headerHtml = '<tr><th>Etapa</th>';
                allTypologies.forEach(t => headerHtml += `<th>${t}</th>`);
                headerHtml += '<th>Total</th></tr>';
                tableThead.innerHTML = headerHtml;

                const groupedByEtapa = data.reduce((acc, d) => {
                    const etapa = d.etapa || 'Não especificado';
                    const tipologia = d.tipologia;
                    if (!tipologia) return acc;

                    if (!acc[etapa]) acc[etapa] = {};
                    acc[etapa][tipologia] = (acc[etapa][tipologia] || 0) + 1;
                    return acc;
                }, {});

                let bodyHtml = '';
                Object.entries(groupedByEtapa).sort((a,b) => a[0].localeCompare(b[0], undefined, {numeric: true})).forEach(([etapa, typologyCounts]) => {
                    let rowHtml = `<tr><td>${etapa}</td>`;
                    let rowTotal = 0;
                    allTypologies.forEach(typology => {
                        const count = typologyCounts[typology] || 0;
                        rowHtml += `<td>${count}</td>`;
                        rowTotal += count;
                    });
                    rowHtml += `<td><b>${rowTotal}</b></td></tr>`;
                    bodyHtml += rowHtml;
                });
                tableBody.innerHTML = bodyHtml || `<tr><td colspan="${allTypologies.length + 2}" style="text-align:center;">Nenhum dado para este agrupamento.</td></tr>`;

            } else {
                const selectedOption = analiseDetalhadaFilter.options[analiseDetalhadaFilter.selectedIndex];
                const headerText = selectedOption.textContent;
                
                tableThead.innerHTML = `
                    <tr>
                        <th>${headerText}</th>
                        <th>Vendidas</th>
                        <th>Reservadas</th>
                        <th>Disponíveis</th>
                        <th>Bloqueadas</th>
                        <th>Outros</th>
                        <th>Total</th>
                    </tr>`;

                const SITUACAO_VENDIDO = ['VENDIDO', 'VENDIDA'];
                const grouped = data.reduce((acc, d) => {
                    const key = d[groupByKey] || 'Não especificado';
                    if (!acc[key]) { acc[key] = { vendidas: 0, reservadas: 0, disponiveis: 0, bloqueadas: 0, outros: 0 }; }
                    const situacao = (d.situacao || '').toUpperCase();
                    if (SITUACAO_VENDIDO.includes(situacao)) { acc[key].vendidas++; }
                    else if (situacao === 'RESERVADA') { acc[key].reservadas++; }
                    else if (situacao === 'DISPONÍVEL' || situacao === 'DISPONIVEL') { acc[key].disponiveis++; }
                    else if (situacao === 'BLOQUEADA' || situacao === 'BLOQUEADO') { acc[key].bloqueadas++; }
                    else { acc[key].outros++; }
                    return acc;
                }, {});

                const analysis = Object.entries(grouped).map(([key, counts]) => {
                    return { key, ...counts, total: counts.vendidas + counts.reservadas + counts.disponiveis + counts.bloqueadas + counts.outros }
                }).sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));

                tableBody.innerHTML = analysis.length > 0
                    ? analysis.map(row => `<tr><td>${row.key}</td><td>${row.vendidas}</td><td>${row.reservadas}</td><td>${row.disponiveis}</td><td>${row.bloqueadas}</td><td>${row.outros}</td><td><b>${row.total}</b></td></tr>`).join('')
                    : '<tr><td colspan="7" style="text-align:center;">Nenhum dado para este agrupamento.</td></tr>';
            }
        } catch (err) {
            console.error("Erro na tabela detalhada:", err);
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Erro ao processar dados.</td></tr>';
        }
    };
    
    // --- Lógica de Interação da UI ---
    
    const setTheme = (theme) => {
        currentTheme = theme;
        localStorage.setItem('theme', theme);
        if (theme === 'dark') {
            body.classList.add('dark-mode');
            darkThemeToggle.checked = true;
        } else {
            body.classList.remove('dark-mode');
            lightThemeToggle.checked = true;
        }
        Object.values(charts).forEach(chart => {
            if(chart) chart.updateOptions({ theme: { mode: theme } });
        });
    };

    lightThemeToggle.addEventListener('change', () => setTheme('light'));
    darkThemeToggle.addEventListener('change', () => setTheme('dark'));
    setTheme(currentTheme);

    sidebarToggle.addEventListener('click', () => {
        body.classList.toggle('sidebar-collapsed');
    });

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
            
            const originalSelect = document.createElement('select');
            originalSelect.id = 'empreendimento-filter';
            originalSelect.innerHTML = '<option value="todos">Todos os Empreendimentos</option>';
            data.empreendimentos.forEach(emp => {
                const option = document.createElement('option');
                option.value = emp;
                option.textContent = emp;
                originalSelect.appendChild(option);
            });
            
            originalSelect.addEventListener('change', (e) => {
                const selectedValue = e.target.value;
                const dataToRender = selectedValue === 'todos' ? fullData : fullData.filter(item => item.empreendimento === selectedValue);
                renderDashboard(dataToRender);
            });
            
            createCustomDropdown(originalSelect);

            renderDashboard(fullData);
            dashboardContainer.classList.remove('hidden');
            setTimeout(() => { dashboardContainer.scrollIntoView({ behavior: 'smooth' }); }, 10);
            showToast("Análise concluída com sucesso!");
        } catch (error) { showToast(error.message, 'error');
        } finally { btnGerar.disabled = false; spinner.hidden = true; }
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
            a.download = `relatorio_analitico_detalhado.xlsx`;
            document.body.appendChild(a); a.click();
            window.URL.revokeObjectURL(url); document.body.removeChild(a);
        } catch (error) { showToast(error.message, 'error');
        } finally { loadingOverlay.classList.add('hidden'); }
    });
    
    btnDownloadPdf.addEventListener('click', () => {
        if (filteredData.length === 0) { showToast("Gere um dashboard antes de gerar o PDF.", 'error'); return; }
        loadingOverlay.classList.remove('hidden');
        
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        
        const filterText = document.querySelector('.custom-select-trigger').textContent;
        
        pdf.setFontSize(22);
        pdf.setTextColor('#1a202c');
        pdf.text('Relatório Analítico de Vendas', 40, 60);

        pdf.setFontSize(12);
        pdf.setTextColor('#718096');
        pdf.text(`Filtro Aplicado: ${filterText}`, 40, 80);
        pdf.text(`Data de Geração: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, 40, 95);

        const kpi_head = [['Indicador', 'Valor']];
        const kpi_body = [
            ['Unidades Vendidas', document.getElementById('kpi-vendidas').textContent],
            ['Unidades Reservadas', document.getElementById('kpi-reservadas').textContent],
            ['Unidades Disponíveis', document.getElementById('kpi-disponiveis').textContent],
            ['Unidades Bloqueadas', document.getElementById('kpi-bloqueadas').textContent],
        ];

        pdf.autoTable({
            head: kpi_head,
            body: kpi_body,
            startY: 140,
            theme: 'grid',
            headStyles: { fillColor: '#4f46e5' },
            styles: { fontSize: 12, cellPadding: 8 },
            columnStyles: {
                0: { fontStyle: 'bold' }
            }
        });
        
        pdf.addPage();
        const dashboardElement = document.getElementById('dashboard-container');
        dashboardElement.classList.add('pdf-capture');

        html2canvas(dashboardElement, { scale: 2, useCORS: true, backgroundColor: body.classList.contains('dark-mode') ? '#111827' : '#f0f2f5' })
        .then(canvas => {
            dashboardElement.classList.remove('pdf-capture');
            
            pdf.text('Resumo Visual do Dashboard', 40, 40);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const ratio = canvas.width / canvas.height;
            let newWidth = pdfWidth - 80;
            let newHeight = newWidth / ratio;
            if (newHeight > pdfHeight - 100) {
                newHeight = pdfHeight - 100;
                newWidth = newHeight * ratio;
            }
            const x = (pdfWidth - newWidth) / 2;
            const y = 60;
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, newWidth, newHeight);
            
            if (charts.vendas) {
                pdf.addPage();
                const title = document.getElementById('vendas-empreendimento-title').textContent;
                const head = [[]];
                const body = [];
                if (charts.vendas.w.config.chart.type === 'donut') {
                    head[0] = ['Tipo de Venda', 'Quantidade'];
                    charts.vendas.w.config.labels.forEach((label, i) => body.push([label, charts.vendas.w.config.series[i]]));
                } else {
                    head[0] = ['Empreendimento', ...charts.vendas.w.config.series.map(s => s.name)];
                    charts.vendas.w.config.xaxis.categories.forEach((cat, i) => body.push([cat, ...charts.vendas.w.config.series.map(s => s.data[i])]));
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
            if (charts.vendasMes) {
                pdf.addPage();
                const head = [['Mês/Ano', 'Unidades Vendidas']];
                const SITUACAO_VENDIDO = ['VENDIDO', 'VENDIDA'];
                const vendasData = filteredData.filter(d => SITUACAO_VENDIDO.includes((d.situacao || '').toUpperCase().trim()) && d.dataVenda);
                const monthlyCounts = vendasData.reduce((acc, item) => {
                    try {
                        const parts = item.dataVenda.split('/');
                        if (parts.length === 3) {
                            const month = parts[1].padStart(2, '0');
                            const year = parts[2];
                            const key = `${year}-${month}`;
                            acc[key] = (acc[key] || 0) + 1;
                        }
                    } catch (e) {}
                    return acc;
                }, {});
                const sortedKeys = Object.keys(monthlyCounts).sort();
                const body = sortedKeys.map(key => {
                    const [year, month] = key.split('-');
                    const formattedDate = `${month}/${year}`;
                    return [formattedDate, monthlyCounts[key]];
                });

                pdf.autoTable({ head, body, startY: 60, didDrawPage: data => pdf.text('Vendas por Mês', 40, 40) });
            }

            pdf.addPage();
            const tableElement = document.getElementById('analise-detalhada-table');
            pdf.autoTable({ html: tableElement, startY: 60, didDrawPage: data => pdf.text('Análise Detalhada', 40, 40) });


            pdf.save(`relatorio_analitico_${new Date().toISOString().slice(0,10)}.pdf`);
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