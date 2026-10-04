# ServiceAproxima — protótipo interativo

HTML + CSS + JavaScript puro. Sem framework, sem banco de dados, sem build.
Os dados ficam só no `localStorage` do navegador. Não há upload de fotos nem gravação de áudio.

## Como rodar
- **VS Code:** extensão *Live Server* > "Open with Live Server" em `index.html`.
- **Terminal:** `python3 -m http.server 8000` dentro da pasta e abra http://localhost:8000
- **GitHub Pages:** suba a pasta e ative o Pages. Funciona sem configuração.

## Testar os dois ambientes
- Na lateral (desktop) há os botões **Ambiente do cliente** e **Ambiente do prestador**.
  No celular, use **Perfil > Alternar para o ambiente...**.
- Contas demo (senha `123456`): `ana@demo.com` (cliente) e `marcos@demo.com` (prestador).
- Também dá para criar contas novas nas duas pontas. O pedido do cliente aparece para o prestador.

## Fluxo para demonstrar
1. Cliente: **+** > descreve o problema > envia (para a região ou direto a um profissional).
2. Profissionais de exemplo respondem sozinhos em poucos segundos (desligue em Perfil > Modo demonstração).
3. Cliente aceita a proposta. O serviço vai para a **Agenda** do prestador.
4. Prestador: **Iniciar serviço** > **Concluir serviço**. (Com profissional de exemplo, use o botão "Demo".)
5. Cliente: **Pagar** (Pix ou cartão simulado, 15% de desconto no 1º serviço) > **Avaliar**.
6. Prestador: vê o ganho em **Ganhos** e a nota em **Avaliações**.

## Estrutura
```
index.html
css/style.css
js/util.js          utilitários, ícones, máscaras
js/config.js        categorias, desconto, taxa
js/storage.js       CAMADA DE PERSISTÊNCIA (único arquivo que toca o localStorage)
js/seed.js          dados de exemplo (Brasília-DF; troque aqui)
js/services.js      regras de negócio (só falam com o storage.js)
js/sim.js           respostas automáticas dos profissionais de exemplo
js/ui.js            componentes (toast, janela, avatar...)
js/views-*.js       telas: auth, cliente, prestador, comum (chat, notificações, perfil)
js/app.js           roteador e inicialização
```

## Migrar para banco real depois
Só `storage.js` conhece o `localStorage`. Crie outro adapter com a mesma interface
(`readTable`, `mutate`, `getKV`, `setKV`, ...) e troque `new LocalStorageAdapter(...)`.
As telas e `services.js` não mudam. Ao migrar, guarde senhas com hash no servidor.

## Observações
- Pagamentos, saques e WhatsApp são simulados/links. O número do cartão nunca é salvo.
- Para zerar tudo: Perfil > Restaurar dados de demonstração.
