# The secure-proxy authentication flow

There are 3 main actors to allow the user to authenticate themselves and to use
the proxy:

- the extension (SP)
- secure-proxy REST API (SPS)
- FxA services

The steps are described here:
https://gitlab.com/shane-tomlinson/mermaid-charts/blob/master/charts/secure-proxy/secure-proxy-signin-with-backend-server.svg

To summarize them, the authentication flow works in this way:

1 The SP requests an oauth state token from SPS.
2. The SP starts the authentication, calling the FxA authorization endpoint, and passing the state token as parameter.
3. The SP obtains the fxa code from the FxA authorization endpoint.
4. The SP sends a "finalize the authentication request" to SPS.

To obtain the proxy token, SP sends an "Info request" to know if the user has
available passes/tokens. If there are passes available, the SP sends a "New
token request".

## SPS REST API

### state token request
This request returns a state token. The token is sent in the JSON response and
set in a session variable.

Request:
* Path: /browser/oauth/state
* Method: GET
* Content-type: application/json

Response:
* State: 201
* Body: `{ state: "ok", state_token: <token> }`
* content-type: application/json

### finalize the authentication request
After the FxA authentication, the extension sends the FxA code (a.k.a.
authorization token) and the state token.

Request:
* Path: /browser/oauth/authenticate
* Method: POST
* Content-type: application/json
* Body: `{ state_token: <token>, fxa_code: <fxaCode> }`

Response:
* State: 200
* Content-type: application/json
* Body: ```{
  state: "ok",
  tiers_enabled: <true/false>,
  proxy_token: <current token string if exists - null otherwise>,
  current_pass: <-1 for unlimited>
  total_passes: <-1 for unlimited>
}```

Possible error codes:
* 400 - missing or invalid state_token or fxa code.

### Info request
Retrieves info about the current proxy tokens used by the user.

Request:
* Path: /browser/oauth/info
* Method: POST
* Content-type: application/json
* Body: `{ state_token: <token> }`

Response:
* State: 200
* Content-type: application/json
* Body: ```{
  state: "ok",
  tiers_enabled: <true/false>,
  proxy_token: <current token string if exists - null otherwise>,
  current_pass: <-1 for unlimited>
  total_passes: <-1 for unlimited>
}```

Possibile error codes:
* 400 - missing or invalid state_token or fxa code.

### New token request:
Token generation request.

Request:
* Path: /browser/oauth/token
* Method: POST
* Content-type: application/json
* Body: `{ state_token: <token> }`

Response:
* State: 200
* Content-type: application/json
* body: ```{
  state: "ok",
  tiers_enabled: <true/false>,
  proxy_token: <new token or null>,
  current_pass: <-1 for unlimited>
  total_passes: <-1 for unlimited>
}```

Possibile error codes:
* 400 - missing or invalid state_token or fxa code.
* 402 - no tokens available for the current user.
