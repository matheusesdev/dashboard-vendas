# app.py

from flask import Flask, render_template, request, jsonify, send_file
import pandas as pd
import numpy as np
from io import StringIO, BytesIO
import traceback
from datetime import datetime
from whitenoise import WhiteNoise # <--- ADICIONADO

app = Flask(__name__)

# ADICIONADO: Configuração do WhiteNoise para servir arquivos estáticos em produção
app.wsgi_app = WhiteNoise(app.wsgi_app, root='static/', prefix='static/')

def processar_e_analisar(estoque_stream, vendas_stream):
    try:
        # --- 1. Carregamento e Verificação ---
        df_estoque = pd.read_csv(StringIO(estoque_stream.read().decode('utf-8-sig')), sep=';', skipfooter=1, engine='python')
        df_vendas = pd.read_csv(StringIO(vendas_stream.read().decode('utf-8-sig')), sep=';')

        df_estoque.columns = [str(col).strip() for col in df_estoque.columns]
        df_vendas.columns = [str(col).strip() for col in df_vendas.columns]
        
        colunas_essenciais_estoque = ['Empreendimento', 'Unidade', 'Situação', 'Tipologia', 'Etapa']
        colunas_essenciais_vendas = ['Empreendimento', 'Unidade', 'Situação atual', 'Tipo de Venda', 'Data Venda']

        for col in colunas_essenciais_estoque:
            if col not in df_estoque.columns: raise KeyError(f"'{col}' no arquivo de Estoque")
        for col in colunas_essenciais_vendas:
            if col not in df_vendas.columns: raise KeyError(f"'{col}' no arquivo de Vendas")

        df_vendas.rename(columns={'Situação atual': 'Situação'}, inplace=True)
        
        colunas_vendas_para_merge = ['Empreendimento', 'Unidade', 'Situação', 'Tipo de Venda', 'Data Venda']
        df_merged = pd.merge(
            df_estoque,
            df_vendas[colunas_vendas_para_merge],
            on=['Empreendimento', 'Unidade'],
            how='left',
            suffixes=('_Estoque', '_Venda')
        )
        
        df_final = pd.DataFrame()
        
        df_final['BLOCO'] = df_merged.get('Bloco_Estoque') or df_merged.get('Bloco')
        df_final['EMPREENDIMENTO'] = df_merged['Empreendimento']
        df_final['ETAPA'] = df_merged['Etapa']
        df_final['SITUAÇÃO'] = df_merged['Situação_Venda'].fillna(df_merged['Situação_Estoque'])
        df_final['TIPO DE VENDA'] = df_merged.get('Tipo de Venda')
        df_final['TIPOLOGIA'] = df_merged['Tipologia']
        df_final['UNIDADE'] = df_merged['Unidade']
        df_final['DATA DA VENDA'] = df_merged.get('Data Venda')

        df_final['SITUAÇÃO'] = df_final['SITUAÇÃO'].astype(str).str.strip().str.upper()
        
        colunas_relatorio = [
            'BLOCO', 'EMPREENDIMENTO', 'ETAPA', 'SITUAÇÃO', 
            'TIPO DE VENDA', 'TIPOLOGIA', 'UNIDADE', 'DATA DA VENDA'
        ]
        
        for col in colunas_relatorio:
            if col not in df_final.columns: df_final[col] = None
        
        df_final = df_final[colunas_relatorio]
        df_final = df_final.replace({pd.NaT: None, np.nan: None, 'nan': None})
        
        empreendimentos_unicos = sorted(df_final['EMPREENDIMENTO'].dropna().unique().tolist())

        data_for_js = df_final.copy()
        data_for_js.columns = [
            'bloco', 'empreendimento', 'etapa', 'situacao', 'tipoVenda', 
            'tipologia', 'unidade', 'dataVenda'
        ]

        return {
            'empreendimentos': empreendimentos_unicos,
            'table_data': data_for_js.to_dict('records')
        }
    except KeyError as ke:
        traceback.print_exc()
        return {"error": f"Coluna essencial não encontrada: {ke}. Verifique os arquivos CSV."}
    except Exception as e:
        traceback.print_exc()
        return {"error": f"Erro inesperado no servidor: {type(e).__name__}."}


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/processar', methods=['POST'])
def processar():
    if 'estoqueFile' not in request.files or 'vendasFile' not in request.files:
        return jsonify({"error": "Arquivos não encontrados."}), 400
    resultado = processar_e_analisar(request.files['estoqueFile'].stream, request.files['vendasFile'].stream)
    if "error" in resultado:
        return jsonify(resultado), 500
    return jsonify(resultado)

@app.route('/download-xlsx', methods=['POST'])
def download_xlsx():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Nenhum dado recebido"}), 400

        df = pd.DataFrame(data)
        
        df.rename(columns={
            'bloco': 'BLOCO', 'empreendimento': 'EMPREENDIMENTO', 'etapa': 'ETAPA', 
            'situacao': 'SITUAÇÃO', 'tipoVenda': 'TIPO DE VENDA', 'tipologia': 'TIPOLOGIA', 
            'unidade': 'UNIDADE', 'dataVenda': 'DATA DA VENDA'
        }, inplace=True)
        
        df['CONTADOR'] = 1
        df_vendas_only = df[df['SITUAÇÃO'].isin(['VENDIDA', 'VENDIDO'])].copy()
        df_vendas_only['DATA DA VENDA'] = pd.to_datetime(df_vendas_only['DATA DA VENDA'], dayfirst=True, errors='coerce')
        df_vendas_only.dropna(subset=['DATA DA VENDA'], inplace=True)
        
        meses = {1: 'Janeiro', 2: 'Fevereiro', 3: 'Março', 4: 'Abril', 5: 'Maio', 6: 'Junho', 7: 'Julho', 8: 'Agosto', 9: 'Setembro', 10: 'Outubro', 11: 'Novembro', 12: 'Dezembro'}
        df_vendas_only['MÊS_ANO_NUM'] = df_vendas_only['DATA DA VENDA'].dt.to_period('M')
        df_vendas_only['MÊS_ANO'] = df_vendas_only['DATA DA VENDA'].dt.month.map(meses) + " de " + df_vendas_only['DATA DA VENDA'].dt.year.astype(str)
        df_vendas_only = df_vendas_only.sort_values('MÊS_ANO_NUM')


        output = BytesIO()
        with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
            workbook = writer.book
            
            title_format = workbook.add_format({'bold': True, 'font_size': 16, 'font_color': '#4F46E5', 'valign': 'vcenter'})
            subtitle_format = workbook.add_format({'bold': True, 'font_size': 11, 'font_color': '#1a202c', 'align': 'left', 'valign': 'vcenter'})
            header_format = workbook.add_format({'bold': True, 'bg_color': '#4F46E5', 'font_color': 'white', 'border': 1, 'align': 'center', 'valign': 'vcenter'})
            number_format = workbook.add_format({'num_format': '#,##0', 'border': 1})
            index_format = workbook.add_format({'bold': True, 'border': 1, 'align': 'left'})
            total_format_num = workbook.add_format({'bold': True, 'bg_color': '#f0f2f5', 'num_format': '#,##0', 'border': 1})
            
            sheet_dashboard = workbook.add_worksheet('Dashboard Resumo')
            sheet_dashboard.hide_gridlines(2)

            sheet_dashboard.set_row(0, 30)
            sheet_dashboard.write('B1', 'Relatório Analítico de Vendas', title_format)
            sheet_dashboard.write('B2', f"Gerado em: {datetime.now().strftime('%d/%m/%Y %H:%M')}", workbook.add_format({'color': '#718096'}))
            
            pivot_vendas_mes = df_vendas_only.pivot_table(index='MÊS_ANO', values='CONTADOR', aggfunc='sum', fill_value=0)
            pivot_vendas_mes = pivot_vendas_mes.reindex(df_vendas_only['MÊS_ANO'].unique())
            pivot_vendas_mes.index.name = 'Mês/Ano'
            pivot_vendas_mes.columns = ['Vendas']

            sheet_dashboard.write('B5', 'Evolução Mensal de Vendas', subtitle_format)
            pivot_vendas_mes.to_excel(writer, sheet_name='Dashboard Resumo', startrow=6, startcol=1, header=False)
            
            sheet_dashboard.set_column('B:B', 20)
            sheet_dashboard.set_column('C:C', 15)
            sheet_dashboard.write('B7', pivot_vendas_mes.index.name, header_format)
            sheet_dashboard.write('C7', pivot_vendas_mes.columns[0], header_format)
            for row_num, (index, row) in enumerate(pivot_vendas_mes.iterrows()):
                 sheet_dashboard.write(7 + row_num, 1, index, index_format)
                 sheet_dashboard.write(7 + row_num, 2, row['Vendas'], number_format)

            chart = workbook.add_chart({'type': 'column'})
            num_rows = len(pivot_vendas_mes)
            chart.add_series({
                'name':       ['Dashboard Resumo', 6, 2],
                'categories': ['Dashboard Resumo', 7, 1, 6 + num_rows, 1],
                'values':     ['Dashboard Resumo', 7, 2, 6 + num_rows, 2],
            })
            chart.set_title({'name': 'Vendas por Mês'})
            chart.set_legend({'position': 'none'})
            chart.set_x_axis({'name': 'Mês'})
            chart.set_y_axis({'name': 'Quantidade de Vendas', 'major_gridlines': {'visible': False}})
            chart.set_plotarea({'border': {'none': True}})
            sheet_dashboard.insert_chart('E5', chart, {'x_scale': 1.5, 'y_scale': 1.2})
            
            sheet_pivots = workbook.add_worksheet('Tabelas Dinâmicas')
            current_row = 1

            def write_and_format_pivot(df_pivot, title, start_row, format_func):
                sheet_pivots.merge_range(start_row, 0, start_row, len(df_pivot.columns), title, subtitle_format)
                df_pivot.to_excel(writer, sheet_name='Tabelas Dinâmicas', startrow=start_row + 2, header=False)
                
                for c_idx, value in enumerate(df_pivot.columns.values):
                    sheet_pivots.write(start_row + 2, c_idx + 1, value, header_format)
                sheet_pivots.write(start_row + 2, 0, df_pivot.index.name, header_format)
                
                for r_idx, index_name in enumerate(df_pivot.index):
                    sheet_pivots.write(start_row + 3 + r_idx, 0, index_name, index_format)
                    for c_idx, _ in enumerate(df_pivot.columns):
                        is_total_row = (index_name == 'Total Geral')
                        cell_format = format_func(is_total_row)
                        sheet_pivots.write(start_row + 3 + r_idx, c_idx + 1, df_pivot.iloc[r_idx, c_idx], cell_format)
                return start_row + len(df_pivot) + 5
            
            pivot_table_1 = df.pivot_table(index='EMPREENDIMENTO', columns='SITUAÇÃO', values='CONTADOR', aggfunc='sum', fill_value=0, margins=True, margins_name='Total Geral')
            current_row = write_and_format_pivot(pivot_table_1, 'Status por Empreendimento', current_row, lambda is_total: total_format_num if is_total else number_format)
            
            pivot_table_2 = df.pivot_table(index='TIPOLOGIA', columns='SITUAÇÃO', values='CONTADOR', aggfunc='sum', fill_value=0, margins=True, margins_name='Total Geral')
            current_row = write_and_format_pivot(pivot_table_2, 'Status por Tipologia', current_row, lambda is_total: total_format_num if is_total else number_format)
            
            sheet_pivots.set_column('A:A', 45)
            sheet_pivots.set_column('B:Z', 18)

            df_final = df.drop(columns=['CONTADOR', 'MÊS_ANO', 'MÊS_ANO_NUM'], errors='ignore')
            df_final.to_excel(writer, index=False, sheet_name='Dados Consolidados')
            worksheet_data = writer.sheets['Dados Consolidados']
            for col_num, value in enumerate(df_final.columns.values):
                worksheet_data.write(0, col_num, value, header_format)
            
            for idx, col in enumerate(df_final):
                series = df_final[col]
                max_len = max((series.astype(str).map(len).max(), len(str(series.name)))) + 2
                max_len = min(max_len, 50)
                worksheet_data.set_column(idx, idx, max_len)

        output.seek(0)
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name='relatorio_analitico_detalhado.xlsx'
        )

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Erro ao gerar o arquivo Excel: {e}"}), 500

if __name__ == '__main__':
    app.run(debug=True)