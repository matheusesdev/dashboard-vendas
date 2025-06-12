# app.py

from flask import Flask, render_template, request, jsonify, send_file
import pandas as pd
import numpy as np
from io import StringIO, BytesIO
import traceback

app = Flask(__name__)

# --- A função processar_e_analisar permanece a mesma ---
def processar_e_analisar(estoque_stream, vendas_stream):
    try:
        # ... (código da função sem alterações) ...
        # --- 1. Carregamento e Verificação ---
        df_estoque = pd.read_csv(StringIO(estoque_stream.read().decode('utf-8-sig')), sep=';', skipfooter=1, engine='python')
        df_vendas = pd.read_csv(StringIO(vendas_stream.read().decode('utf-8-sig')), sep=';')

        df_estoque.columns = [str(col).strip() for col in df_estoque.columns]
        df_vendas.columns = [str(col).strip() for col in df_vendas.columns]
        
        colunas_essenciais_estoque = ['Empreendimento', 'Unidade', 'Situação', 'Valor VGV', 'Tipologia', 'Etapa']
        colunas_essenciais_vendas = ['Empreendimento', 'Unidade', 'Situação atual', 'Valor do contrato', 'Tipo de Venda']

        for col in colunas_essenciais_estoque:
            if col not in df_estoque.columns: raise KeyError(f"'{col}' no arquivo de Estoque")
        for col in colunas_essenciais_vendas:
            if col not in df_vendas.columns: raise KeyError(f"'{col}' no arquivo de Vendas")

        df_vendas.rename(columns={'Situação atual': 'Situação', 'Valor do contrato': 'Valor VGV'}, inplace=True)
        
        # --- 2. Consolidação com Merge ---
        df_merged = pd.merge(
            df_estoque,
            df_vendas[['Empreendimento', 'Unidade', 'Situação', 'Valor VGV', 'Tipo de Venda']],
            on=['Empreendimento', 'Unidade'],
            how='left',
            suffixes=('_Estoque', '_Venda')
        )
        
        # --- 3. Criação do DataFrame final para o relatório ---
        df_final = pd.DataFrame()
        
        df_final['BLOCO'] = df_merged.get('Bloco_Estoque') or df_merged.get('Bloco')
        df_final['EMPREENDIMENTO'] = df_merged['Empreendimento']
        df_final['ETAPA'] = df_merged['Etapa']
        df_final['SITUAÇÃO'] = df_merged['Situação_Venda'].fillna(df_merged['Situação_Estoque'])
        df_final['TIPO DE VENDA'] = df_merged.get('Tipo de Venda')
        df_final['TIPOLOGIA'] = df_merged['Tipologia']
        df_final['UNIDADE'] = df_merged['Unidade']
        df_final['VALOR PV'] = df_merged['Valor VGV_Estoque']
        df_final['VALOR DO CONTRATO'] = df_merged['Valor VGV_Venda'].fillna(df_merged['Valor VGV_Estoque'])

        # --- 4. Limpeza e Formatação ---
        for col in ['VALOR PV', 'VALOR DO CONTRATO']:
            df_final[col] = pd.to_numeric(
                df_final[col].astype(str).str.replace(r'[R$.\s]', '', regex=True).str.replace(',', '.'),
                errors='coerce'
            ).fillna(0)

        df_final['SITUAÇÃO'] = df_final['SITUAÇÃO'].astype(str).str.strip().str.upper()
        
        colunas_relatorio = [
            'BLOCO', 'EMPREENDIMENTO', 'ETAPA', 'SITUAÇÃO', 
            'TIPO DE VENDA', 'TIPOLOGIA', 'UNIDADE', 'VALOR PV', 'VALOR DO CONTRATO'
        ]
        
        for col in colunas_relatorio:
            if col not in df_final.columns: df_final[col] = None
        
        df_final = df_final[colunas_relatorio]
        df_final = df_final.replace({pd.NaT: None, np.nan: None, 'nan': None})
        
        empreendimentos_unicos = sorted(df_final['EMPREENDIMENTO'].dropna().unique().tolist())

        # --- 5. Preparação dos dados para o Frontend (JavaScript) ---
        data_for_js = df_final.copy()
        data_for_js.columns = [
            'bloco', 'empreendimento', 'etapa', 'situacao', 'tipoVenda', 
            'tipologia', 'unidade', 'valorPV', 'valorContrato'
        ]

        return {
            'empreendimentos': empreendimentos_unicos,
            'table_data': data_for_js.to_dict('records')
        }
    except Exception as e:
        traceback.print_exc()
        return {"error": f"Erro inesperado no servidor: {type(e).__name__}."}


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/processar', methods=['POST'])
def processar():
    # ... (código da rota sem alterações) ...
    if 'estoqueFile' not in request.files or 'vendasFile' not in request.files:
        return jsonify({"error": "Arquivos não encontrados."}), 400
    resultado = processar_e_analisar(request.files['estoqueFile'].stream, request.files['vendasFile'].stream)
    if "error" in resultado:
        return jsonify(resultado), 500
    return jsonify(resultado)

# --- ROTA DE DOWNLOAD ATUALIZADA COM TABELAS DINÂMICAS ---
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
            'unidade': 'UNIDADE', 'valorPV': 'VALOR PV', 'valorContrato': 'VALOR DO CONTRATO'
        }, inplace=True)
        
        # Garante que a coluna de contagem exista para as tabelas dinâmicas
        df['CONTADOR'] = 1

        output = BytesIO()
        with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
            # --- Aba 1: Dados Brutos ---
            df.drop(columns=['CONTADOR']).to_excel(writer, index=False, sheet_name='Dados Consolidados')
            workbook = writer.book
            worksheet1 = writer.sheets['Dados Consolidados']
            header_format = workbook.add_format({'bold': True, 'text_wrap': True, 'valign': 'top', 'fg_color': '#D7E4BC', 'border': 1, 'align': 'center'})
            currency_format = workbook.add_format({'num_format': 'R$ #,##0.00'})
            for col_num, value in enumerate(df.drop(columns=['CONTADOR']).columns.values):
                worksheet1.write(0, col_num, value, header_format)
            for idx, col in enumerate(df.drop(columns=['CONTADOR'])):
                max_len = max((df[col].astype(str).map(len).max(), len(str(df[col].name)))) + 3
                if max_len > 50: max_len = 50
                worksheet1.set_column(idx, idx, max_len)
                if 'VALOR' in col:
                    worksheet1.set_column(idx, idx, max_len, currency_format)

            # --- Aba 2: Tabelas Dinâmicas ---
            worksheet2 = workbook.add_worksheet('Tabelas Dinâmicas')
            bold_format = workbook.add_format({'bold': True})

            # Tabela Dinâmica 1: Status por Empreendimento
            worksheet2.write('A1', 'Status por Empreendimento', bold_format)
            pivot_table_1 = df.pivot_table(index='EMPREENDIMENTO', columns='SITUAÇÃO', values='CONTADOR', aggfunc='sum', fill_value=0)
            pivot_table_1.to_excel(writer, sheet_name='Tabelas Dinâmicas', startrow=2, startcol=0)

            # Tabela Dinâmica 2: Status por Tipologia
            start_row_2 = len(pivot_table_1) + 6
            worksheet2.write(f'A{start_row_2}', 'Status por Tipologia', bold_format)
            pivot_table_2 = df.pivot_table(index='TIPOLOGIA', columns='SITUAÇÃO', values='CONTADOR', aggfunc='sum', fill_value=0)
            pivot_table_2.to_excel(writer, sheet_name='Tabelas Dinâmicas', startrow=start_row_2 + 1, startcol=0)
            
            # Tabela Dinâmica 3: VGV Realizado por Empreendimento e Situação
            start_row_3 = start_row_2 + len(pivot_table_2) + 6
            worksheet2.write(f'A{start_row_3}', 'VGV por Empreendimento e Situação', bold_format)
            pivot_table_3 = df.pivot_table(index='EMPREENDIMENTO', columns='SITUAÇÃO', values='VALOR DO CONTRATO', aggfunc='sum', fill_value=0)
            pivot_table_3.to_excel(writer, sheet_name='Tabelas Dinâmicas', startrow=start_row_3 + 1, startcol=0)

        output.seek(0)
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name='relatorio_analitico.xlsx'
        )

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Erro ao gerar o arquivo Excel: {e}"}), 500

if __name__ == '__main__':
    app.run(debug=True)