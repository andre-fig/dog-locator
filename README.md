# Dog Locator

Página estática com ficha do animal e notificação de localização ao tutor.

Para testar localmente, execute `python3 -m http.server 8000` e abra
`http://localhost:8000/dog.html?id=0`. Em produção, utilize HTTPS. Abrir o HTML
diretamente por `file://` não é suportado: templates e localização dependem do navegador.

## Notificação

- Ao abrir a ficha, busca a localização aproximada por IPinfo e envia o primeiro
  e-mail sem aguardar a permissão do GPS.
- Em paralelo, tenta obter o GPS por até 10 segundos, com um limite adicional
  contra navegadores que não chamem os callbacks. Se funcionar, envia um segundo
  e-mail identificado como localização exata. Isso também acontece automaticamente
  quando a permissão já foi concedida antes e não aparece nenhuma pergunta.
  Se for negado ou falhar, mantém somente o envio aproximado.
- Os envios são sequenciais, respeitando o limite de um pedido por segundo do
  EmailJS. Uma falha no IP não impede a tentativa de envio do GPS.
- A tentativa manual repete somente os envios que não foram confirmados durante
  essa abertura da página; não repete um e-mail já confirmado.
- Só envia coordenadas válidas, preservando os parâmetros do template EmailJS:
  `to_name`, `email_to`, `location`, `location_type`, `dog_name`.
- O status e eventuais erros aparecem na ficha. Uma tentativa manual pode ser
  feita após falha. Não há reenvio automático de um e-mail sem confirmação,
  pois ele pode ter sido aceito antes do timeout.
- A confirmação de sucesso da API indica que o serviço aceitou o envio; a
  entrega na caixa de entrada é uma etapa posterior.

O serviço e o template continuam sendo `service_dogemail` e `template_dogemail`.
A chave EmailJS usada no cliente é pública; nenhuma chave privada deve ser
adicionada ao JavaScript. As restrições de domínio e as credenciais do serviço
de e-mail são configuradas no painel do EmailJS.

## Testes

Execute `node --test tests/location-email.test.cjs` (Node.js 18 ou superior).
Os testes simulam GPS, IPinfo e EmailJS e **não enviam e-mails reais**.
