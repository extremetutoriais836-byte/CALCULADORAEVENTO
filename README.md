# Check-in · Papo de Business

Ferramenta de confirmação de convidados na portaria do evento **Papo de Business (26/09/2026)**.
Site 100% estático (HTML + CSS + JS), sem backend — pronto para GitHub + Vercel.

## Como funciona

1. **Carregar a lista** — aba *Confirmados* → *Base de convidados* → enviar a planilha (.xlsx, .xls ou .csv).
2. **Buscar o convidado** — aba *Check-in*: digite o nome (sem precisar de acento), telefone ou e-mail.
   - A busca olha o **início do nome completo**, sempre em **ordem alfabética**. Digitar `D` lista apenas quem tem o nome começando com D.
   - Digitar `Davi` mostra primeiro todos os "Davi…" e, logo abaixo, os demais nomes com D. Quanto mais letras, mais preciso (`Davi A` → Davi Augusto…).
   - Números buscam pelo telefone e textos com `@` buscam pelo e-mail. Só se nenhum nome começar com o que foi digitado, o app mostra quem tem aquilo no sobrenome.
   - Barra **A–Z** para navegar por letra e botão **Todos** para ver a lista inteira de A a Z.
   - `Enter` abre o convidado quando há um único resultado ou o nome exato.
3. **Adicionar manualmente** — botão **+ Adicionar** (também aparece quando a busca não encontra ninguém, já com o nome preenchido). Pede nome, telefone, e-mail (opcional), se comprou e se é premium. Se a pessoa já existir na lista (mesmo e-mail, telefone ou nome), o app avisa antes de duplicar. Depois de salvar, segue direto para liberar a entrada.
4. **Validação**
   - Está na lista **e comprou** → botão **Liberar entrada** → *ACESSO LIBERADO* (destaque dourado se for **Premium**).
   - Está na lista mas **não comprou** → *ACESSO NÃO LIBERADO*.
   - **Já entrou** → aviso com o horário da entrada (evita entrada duplicada).
   - Não está na lista → *Não encontrado*.
5. **Trouxe mais alguém?** — *Sim* pede nome + telefone do acompanhante e pergunta de novo; *Não* volta para a busca do próximo convidado.
6. **Confirmados** — números em tempo real, lista completa com acompanhantes, filtros, desfazer entrada, exportação para Excel/CSV (inclui aba "Pagantes ausentes").

## Formato da planilha

Primeira linha com os títulos. Os nomes das colunas são reconhecidos com variações:

| Coluna   | Também aceita                                   | Valores                                   |
|----------|--------------------------------------------------|-------------------------------------------|
| Nome     | Nome completo, Participante, Convidado, Cliente   | texto                                     |
| Número   | Telefone, Celular, WhatsApp                       | qualquer formato                          |
| E-mail   | Email                                             | texto                                     |
| Comprou  | Pago, Pagamento, Status, Status do pagamento      | Sim / Não (também Pago, Aprovado, X, 1)   |
| Premium  | VIP, Tipo de ingresso, Categoria                  | Sim / Não (também Premium, VIP)           |

Há um botão **Modelo** no app para baixar uma planilha de exemplo.

## Novas planilhas e cruzamento de dados

Você pode carregar quantas planilhas quiser, a qualquer momento. Antes de importar, o app mostra a prévia do cruzamento e deixa escolher:

- **Atualizar lista** — a nova planilha substitui a anterior (ex.: versão mais recente da lista de vendas).
- **Somar à lista atual** — junta com quem já está no app (ex.: uma segunda lista de vendas, lista VIP, cortesias).

Em qualquer caso a mesma pessoa é reconhecida por **e-mail**, depois **telefone** (últimos 8 dígitos) e depois **nome completo** (só se e-mail/telefone não forem diferentes). Assim:

- ninguém é duplicado, nem linhas repetidas dentro da própria planilha;
- quem foi **adicionado manualmente** continua na lista; se aparecer na planilha, os cadastros são **unificados** (se a equipe marcou "comprou" ou "premium" na porta, isso é mantido);
- as **entradas já confirmadas** e os acompanhantes são mantidos; quem já entrou e não está mais na planilha aparece como "fora da lista atual".

O Excel exportado tem a aba **Base completa** no mesmo formato de importação (Nome, Número, E-mail, Comprou, Premium + Origem), então dá para reaproveitar a base do app em outro aparelho.

## Onde ficam os dados

- A lista e as confirmações ficam salvas **no navegador do aparelho** (localStorage). Nada é enviado para servidor.
- A planilha de convidados **não vai para o GitHub** (o `.gitignore` bloqueia .xlsx/.csv) — ela é carregada direto no app.
- Cada aparelho tem sua própria lista. Se usar mais de um celular na portaria, cada um registra as próprias entradas — no fim, exporte o Excel de cada aparelho. Recarregar a página não apaga nada.
- Depois de aberto uma vez, o app funciona mesmo se a internet do local cair.

## Deploy (GitHub + Vercel)

Todos os arquivos ficam na pasta principal (sem subpastas).

1. No GitHub, crie um repositório (ex.: `papo-de-business-checkin`).
2. Clique em **Add file → Upload files**, selecione **todos os arquivos** desta pasta e arraste para a página → **Commit changes**.
3. Na Vercel: **Add New → Project → Import** o repositório → Framework Preset **Other** → sem build command → **Deploy**.

Para atualizar depois: suba os arquivos novos do mesmo jeito (eles substituem os antigos) e a Vercel publica sozinha.

> Não suba a planilha de convidados para o GitHub — ela é carregada direto no app.

## Arquivos

| Arquivo | Função |
|---|---|
| `index.html` | página do app |
| `style.css` | identidade visual (dourado #F7E69E → #6F5732) |
| `app.js` | lógica do check-in, busca, cadastro manual e cruzamento de planilhas |
| `xlsx.full.min.js` | leitura/escrita de planilhas (SheetJS) |
| `*.woff2` | fontes Orbitron e Montserrat (funcionam offline) |
| `logo-papo-de-business.png`, `favicon.png`, `icon-*.png`, `apple-touch-icon.png` | logo e ícones |
| `sw.js` | funcionamento offline |
| `manifest.webmanifest` | permite "Adicionar à tela inicial" no celular |
| `vercel.json` | configuração da Vercel |
