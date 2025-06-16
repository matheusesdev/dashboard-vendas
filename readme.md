# Dashboard Analítico de Vendas Imobiliárias

> Uma aplicação web desenvolvida com Flask e Pandas para processar relatórios de vendas e estoque em CSV, gerando um dashboard interativo e dinâmico para análise de performance.

---

## ✨ Features Principais

-   **Upload de Arquivos:** Interface simples para o upload de relatórios de **Estoque** e **Vendas** no formato CSV.
-   **Processamento Automático:** Consolidação inteligente dos dados dos dois relatórios usando a biblioteca Pandas.
-   **Dashboard Interativo:**
    -   **KPIs (Key Performance Indicators):** Visão rápida das principais métricas (Unidades Vendidas, Reservadas, Disponíveis, etc.).
    -   **Gráficos Dinâmicos:** Análises visuais de vendas por empreendimento, tipologia, etapa e evolução mensal.
-   **Filtro Dinâmico:** Filtre todo o dashboard por empreendimento para uma análise focada.
-   **Análise Detalhada:** Tabela de dados agrupados por diferentes critérios (Empreendimento, Tipologia, Etapa) para uma visão granular.
-   **Exportação de Relatórios:**
    -   **Excel (XLSX):** Baixe um relatório detalhado contendo os dados consolidados, tabelas dinâmicas e gráficos.
    -   **PDF:** Gere um relatório executivo em PDF com os principais KPIs, gráficos e tabelas.
-   **Tema Claro e Escuro:** Alterne entre os temas para melhor conforto visual.
-   **Design Responsivo:** Interface adaptável para diferentes tamanhos de tela.

---

## 🛠️ Tech Stack

-   **Backend:**
    -   [Flask](https://flask.palletsprojects.com/): Micro-framework web em Python.
    -   [Pandas](https://pandas.pydata.org/): Biblioteca para manipulação e análise de dados.
    -   [Numpy](https://numpy.org/): Biblioteca para computação numérica.
    -   [XlsxWriter](https://xlsxwriter.readthedocs.io/): Biblioteca para criar arquivos Excel (.xlsx).
    -   [WhiteNoise](http://whitenoise.evans.io/): Para servir arquivos estáticos em produção.

-   **Frontend:**
    -   HTML5, CSS3, JavaScript (Vanilla).
    -   [ApexCharts.js](https://apexcharts.com/): Biblioteca para a criação de gráficos interativos.
    -   [jsPDF](https://github.com/parallax/jsPDF) & [jsPDF-AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable): Para a geração de relatórios em PDF.
    -   [html2canvas](https://html2canvas.hertzen.com/): Para capturar os elementos do dashboard como imagem para o PDF.

---

## 🚀 Como Executar o Projeto

Siga os passos abaixo para configurar e rodar a aplicação em seu ambiente local.

### Pré-requisitos

-   [Python 3.8+](https://www.python.org/downloads/)
-   `pip` (gerenciador de pacotes do Python)
-   `virtualenv` (recomendado para criar ambientes virtuais)

### Instalação e Execução

1.  **Clone o repositório:**
    ```bash
    git clone https://github.com/seu-usuario/seu-repositorio.git
    cd seu-repositorio
    ```

2.  **Crie e ative um ambiente virtual (recomendado):**
    ```bash
    # Criar o ambiente
    python -m venv venv

    # Ativar no Windows
    .\venv\Scripts\activate

    # Ativar no macOS/Linux
    source venv/bin/activate
    ```

3.  **Instale as dependências a partir do arquivo `requirements.txt`:**
    ```bash
    pip install -r requirements.txt
    ```
    *(Se o arquivo `requirements.txt` não existir, crie-o com `pip freeze > requirements.txt` após instalar as bibliotecas manualmente)*

4.  **Execute a aplicação:**
    ```bash
    flask run
    ```
    Ou, alternativamente:
    ```bash
    python app.py
    ```

5.  **Acesse a aplicação:**
    Abra seu navegador e acesse [http://127.0.0.1:5000](http://127.0.0.1:5000).

---

## 📋 Como Usar

1.  Com a aplicação aberta no navegador, utilize a interface na barra lateral para carregar os arquivos.
2.  Clique em **"Selecionar arquivo"** para carregar o relatório de **Estoque** e, em seguida, o de **Vendas**.
3.  Após selecionar os dois arquivos, o botão **"Gerar Dashboard"** será habilitado. Clique nele.
4.  Aguarde o processamento. O dashboard será exibido com os KPIs, gráficos e tabelas.
5.  Use o seletor no topo para filtrar os dados por um empreendimento específico ou ver todos.
6.  Para baixar os relatórios, use os botões **"Baixar Planilha (XLSX)"** ou **"Gerar Relatório (PDF)"** na barra lateral.

### Estrutura dos Arquivos CSV

Para que a aplicação funcione corretamente, os arquivos CSV devem conter as seguintes colunas (a ordem e a presença de outras colunas não importam):

-   **Relatório de Estoque (`estoqueFile`):**
    -   `Empreendimento`
    -   `Unidade`
    -   `Situação`
    -   `Tipologia`
    -   `Etapa`
-   **Relatório de Vendas (`vendasFile`):-**
    -   `Empreendimento`
    -   `Unidade`
    -   `Situação atual`
    -   `Tipo de Venda`
    -   `Data Venda`

---

## 📂 Estrutura do Projeto

```
.
├── app.py                  # Lógica do backend (Flask, Pandas, WhiteNoise)
├── requirements.txt        # Dependências do Python
├── static/
│   ├── css/
│   │   └── style.css       # Estilos da aplicação
│   ├── img/
│   │   ├── logo_vca.png    # Logo da empresa
│   └── js/
│       └── script.js       # Lógica do frontend (Charts, Interatividade)
└── templates/
    └── index.html          # Estrutura principal da página
```

---

## 👤 Autor

Desenvolvido por **Matheus Santos**.

-   **Setor:** Imobiliário
-   **Subsetor:** Sistemas
