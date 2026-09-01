# Calculadora do evento — Papo de Business

Simulador de custos, receita e ponto de equilíbrio do evento presencial de 26/09/2026.
Site estático, sem build e sem dependências: um único `index.html`.

## Estrutura

```
index.html    aplicação completa (HTML + CSS + JS inline)
vercel.json   headers de segurança, cleanUrls e cache
robots.txt    bloqueio de indexação
```

## Deploy

**Pela CLI**

```bash
npm i -g vercel
vercel          # preview
vercel --prod   # produção
```

Quando perguntar o framework, escolha **Other**. Não há build command nem output directory.

**Pelo painel**

Importe o repositório em vercel.com/new, deixe o framework como *Other* e clique em Deploy.

## Proteger o acesso

O arquivo contém a estrutura de custos e a projeção de resultado do evento. A URL da Vercel é
pública por padrão, e `robots.txt` apenas evita indexação — não impede acesso de quem tiver o link.

Antes de compartilhar, ative em **Project → Settings → Deployment Protection**:

- **Vercel Authentication** — só membros do time entram (disponível em qualquer plano)
- **Password Protection** — senha única para compartilhar com o parceiro (planos pagos)

## Persistência

O botão *Salvar cenário* usa `localStorage`. Os dados ficam no navegador de cada pessoa,
não em servidor, e não são compartilhados entre dispositivos.

## Ajustes comuns

| O que mudar | Onde |
|---|---|
| Valores padrão das despesas | objeto `PADRAO` no final do `index.html` |
| Cenários dos três botões | objeto `CENARIOS` |
| Teto de CAC (hoje 30% do líquido) | constante `teto` dentro de `calcular()` |
