"use strict";
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };

  // node_modules/@hellocoop/httpsig/dist/esm/errors.js
  function invalidKey(message) {
    return new SignatureVerificationError("invalid_key", message);
  }
  function unsupportedAlgorithm(message, supportedAlgorithms) {
    return new SignatureVerificationError("unsupported_algorithm", message, {
      supportedAlgorithms
    });
  }
  var SignatureVerificationError;
  var init_errors = __esm({
    "node_modules/@hellocoop/httpsig/dist/esm/errors.js"() {
      SignatureVerificationError = class extends Error {
        code;
        requiredInput;
        supportedAlgorithms;
        constructor(code, message, options = {}) {
          super(message, { cause: options.cause });
          this.name = "SignatureVerificationError";
          this.code = code;
          this.requiredInput = options.requiredInput;
          this.supportedAlgorithms = options.supportedAlgorithms;
        }
      };
    }
  });

  // node_modules/@hellocoop/httpsig/dist/esm/utils/base64.js
  function bytesToBase64(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  function base64Encode(data) {
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
    return bytesToBase64(bytes);
  }
  async function sha256(data) {
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
    const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
    return new Uint8Array(hashBuffer);
  }
  var init_base64 = __esm({
    "node_modules/@hellocoop/httpsig/dist/esm/utils/base64.js"() {
    }
  });

  // node_modules/@hellocoop/httpsig/dist/esm/vendor/structured-headers/types.js
  var ByteSequence;
  var init_types = __esm({
    "node_modules/@hellocoop/httpsig/dist/esm/vendor/structured-headers/types.js"() {
      ByteSequence = class {
        base64Value;
        constructor(base64Value) {
          this.base64Value = base64Value;
        }
        toBase64() {
          return this.base64Value;
        }
      };
    }
  });

  // node_modules/@hellocoop/httpsig/dist/esm/vendor/structured-headers/util.js
  function isAscii(str) {
    return asciiRe.test(str);
  }
  function isValidTokenStr(str) {
    return tokenRe.test(str);
  }
  function isValidKeyStr(str) {
    return keyRe.test(str);
  }
  function isInnerList(input) {
    return Array.isArray(input[0]);
  }
  var asciiRe, tokenRe, keyRe;
  var init_util = __esm({
    "node_modules/@hellocoop/httpsig/dist/esm/vendor/structured-headers/util.js"() {
      asciiRe = /^[\x20-\x7E]*$/;
      tokenRe = /^[a-zA-Z*][:/!#$%&'*+\-.^_`|~A-Za-z0-9]*$/;
      keyRe = /^[a-z*][*\-_.a-z0-9]*$/;
    }
  });

  // node_modules/@hellocoop/httpsig/dist/esm/vendor/structured-headers/token.js
  var Token;
  var init_token = __esm({
    "node_modules/@hellocoop/httpsig/dist/esm/vendor/structured-headers/token.js"() {
      init_util();
      Token = class {
        value;
        constructor(value) {
          if (!isValidTokenStr(value)) {
            throw new TypeError("Invalid character in Token string. Tokens must start with *, A-Z and the rest of the string may only contain a-z, A-Z, 0-9, :/!#$%&'*+-.^_`|~");
          }
          this.value = value;
        }
        toString() {
          return this.value;
        }
      };
    }
  });

  // node_modules/@hellocoop/httpsig/dist/esm/vendor/structured-headers/parser.js
  var init_parser = __esm({
    "node_modules/@hellocoop/httpsig/dist/esm/vendor/structured-headers/parser.js"() {
      init_types();
      init_token();
      init_util();
    }
  });

  // node_modules/@hellocoop/httpsig/dist/esm/vendor/structured-headers/serializer.js
  function serializeDictionary(input) {
    return Array.from(input.entries()).map(([key, value]) => {
      let out = serializeKey(key);
      if (value[0] === true) {
        out += serializeParameters(value[1]);
      } else {
        out += "=";
        if (isInnerList(value)) {
          out += serializeInnerList(value);
        } else {
          out += serializeItem(value);
        }
      }
      return out;
    }).join(", ");
  }
  function serializeItem(input) {
    return serializeBareItem(input[0]) + serializeParameters(input[1]);
  }
  function serializeInnerList(input) {
    return `(${input[0].map((value) => serializeItem(value)).join(" ")})${serializeParameters(input[1])}`;
  }
  function serializeBareItem(input) {
    if (typeof input === "number") {
      if (Number.isInteger(input)) {
        return serializeInteger(input);
      }
      return serializeDecimal(input);
    }
    if (typeof input === "string") {
      return serializeString(input);
    }
    if (input instanceof Token) {
      return serializeToken(input);
    }
    if (input instanceof ByteSequence) {
      return serializeByteSequence(input);
    }
    if (typeof input === "boolean") {
      return serializeBoolean(input);
    }
    throw new SerializeError(`Cannot serialize values of type ${typeof input}`);
  }
  function serializeInteger(input) {
    if (input < -999999999999999 || input > 999999999999999) {
      throw new SerializeError("Structured headers can only encode integers in the range range of -999,999,999,999,999 to 999,999,999,999,999 inclusive");
    }
    return input.toString();
  }
  function serializeDecimal(input) {
    const out = input.toFixed(3).replace(/0+$/, "");
    const signifantDigits = out.split(".")[0].replace("-", "").length;
    if (signifantDigits > 12) {
      throw new SerializeError("Fractional numbers are not allowed to have more than 12 significant digits before the decimal point");
    }
    return out;
  }
  function serializeString(input) {
    if (!isAscii(input)) {
      throw new SerializeError("Only ASCII strings may be serialized");
    }
    return `"${input.replace(/("|\\)/g, (v) => "\\" + v)}"`;
  }
  function serializeBoolean(input) {
    return input ? "?1" : "?0";
  }
  function serializeByteSequence(input) {
    return `:${input.toBase64()}:`;
  }
  function serializeToken(input) {
    return input.toString();
  }
  function serializeParameters(input) {
    return Array.from(input).map(([key, value]) => {
      let out = ";" + serializeKey(key);
      if (value !== true) {
        out += "=" + serializeBareItem(value);
      }
      return out;
    }).join("");
  }
  function serializeKey(input) {
    if (!isValidKeyStr(input)) {
      throw new SerializeError("Keys in dictionaries must only contain lowercase letter, numbers, _-*. and must start with a letter or *");
    }
    return input;
  }
  var SerializeError;
  var init_serializer = __esm({
    "node_modules/@hellocoop/httpsig/dist/esm/vendor/structured-headers/serializer.js"() {
      init_types();
      init_token();
      init_util();
      SerializeError = class extends Error {
      };
    }
  });

  // node_modules/@hellocoop/httpsig/dist/esm/structured-fields.js
  var init_structured_fields = __esm({
    "node_modules/@hellocoop/httpsig/dist/esm/structured-fields.js"() {
      init_parser();
      init_serializer();
      init_token();
      init_types();
      init_util();
      init_token();
    }
  });

  // node_modules/@hellocoop/httpsig/dist/esm/utils/signature.js
  function buildSignatureParams(components, created) {
    const items = components.map((component) => [
      component,
      /* @__PURE__ */ new Map()
    ]);
    return [items, /* @__PURE__ */ new Map([["created", created]])];
  }
  function generateSignatureBase(components, componentValues) {
    const lines = [];
    for (const component of components) {
      const value = componentValues.get(component);
      if (value === void 0) {
        throw new Error(`Missing value for component: ${component}`);
      }
      lines.push(`"${component}": ${value}`);
    }
    return lines.join("\n");
  }
  function generateSignatureInputHeader(label, components, created) {
    return serializeDictionary(/* @__PURE__ */ new Map([[label, buildSignatureParams(components, created)]]));
  }
  function generateSignatureParams(components, created) {
    return serializeInnerList(buildSignatureParams(components, created));
  }
  function generateSignatureKeyHeader(label, signatureKey, publicJwk2) {
    const oneMember = (scheme, params) => serializeDictionary(/* @__PURE__ */ new Map([
      [label, [new Token(scheme), new Map(params)]]
    ]));
    if (signatureKey.type === "hwk") {
      if (!publicJwk2) {
        throw new Error("Public JWK required for hwk signature key type");
      }
      if (!publicJwk2.alg) {
        throw new Error("Public JWK missing required alg member for hwk signature key type");
      }
      const params = [
        ["alg", publicJwk2.alg],
        ["kty", publicJwk2.kty]
      ];
      if (publicJwk2.crv)
        params.push(["crv", publicJwk2.crv]);
      if (publicJwk2.x)
        params.push(["x", publicJwk2.x]);
      if (publicJwk2.y)
        params.push(["y", publicJwk2.y]);
      if (publicJwk2.n)
        params.push(["n", publicJwk2.n]);
      if (publicJwk2.e)
        params.push(["e", publicJwk2.e]);
      return oneMember("hwk", params);
    }
    if (signatureKey.type === "jwt") {
      return oneMember("jwt", [["jwt", signatureKey.jwt]]);
    }
    if (signatureKey.type === "jkt_jwt") {
      return oneMember("jkt-jwt", [["jwt", signatureKey.jwt]]);
    }
    if (signatureKey.type === "jwks_uri") {
      return oneMember("jwks_uri", [
        ["id", signatureKey.id],
        ["dwk", signatureKey.dwk],
        ["kid", signatureKey.kid]
      ]);
    }
    throw new Error(`Unsupported signature key type: ${signatureKey.type}`);
  }
  function generateSignatureHeader(label, signature) {
    return serializeDictionary(/* @__PURE__ */ new Map([
      [
        label,
        [
          new ByteSequence(base64Encode(signature)),
          /* @__PURE__ */ new Map()
        ]
      ]
    ]));
  }
  async function generateContentDigest(body) {
    let bytes;
    if (typeof body === "string") {
      bytes = new TextEncoder().encode(body);
    } else if (body instanceof Uint8Array) {
      bytes = body;
    } else if (body instanceof ArrayBuffer) {
      bytes = new Uint8Array(body);
    } else if (Buffer.isBuffer(body)) {
      bytes = new Uint8Array(body);
    } else {
      throw new Error(`Cannot generate content-digest for body type: ${body?.constructor?.name ?? typeof body}`);
    }
    const hash = await sha256(bytes);
    const encoded = base64Encode(hash);
    return `sha-256=:${encoded}:`;
  }
  var init_signature = __esm({
    "node_modules/@hellocoop/httpsig/dist/esm/utils/signature.js"() {
      init_base64();
      init_errors();
      init_structured_fields();
    }
  });

  // node_modules/@hellocoop/httpsig/dist/esm/types.js
  var VALID_DERIVED_COMPONENTS = [
    "@method",
    "@target-uri",
    "@authority",
    "@scheme",
    "@request-target",
    "@path",
    "@query",
    "@query-param",
    "@status"
  ];
  var DEFAULT_COMPONENTS_GET = [
    "@method",
    "@authority",
    "@path",
    "signature-key"
  ];
  var DEFAULT_COMPONENTS_BODY = [
    "@method",
    "@authority",
    "@path",
    "content-type",
    "signature-key"
  ];

  // node_modules/@hellocoop/httpsig/dist/esm/utils/crypto.js
  init_errors();
  var FULLY_SPECIFIED_ALGORITHMS = {
    Ed25519: {
      kty: "OKP",
      crv: "Ed25519",
      params: { name: "Ed25519" }
    },
    Ed448: {
      kty: "OKP",
      crv: "Ed448",
      params: { name: "Ed448" }
    },
    ES256: {
      kty: "EC",
      crv: "P-256",
      params: { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" }
    },
    ES384: {
      kty: "EC",
      crv: "P-384",
      params: { name: "ECDSA", namedCurve: "P-384", hash: "SHA-384" }
    },
    ES512: {
      kty: "EC",
      crv: "P-521",
      params: { name: "ECDSA", namedCurve: "P-521", hash: "SHA-512" }
    },
    PS256: {
      kty: "RSA",
      params: { name: "RSA-PSS", hash: "SHA-256", saltLength: 32 }
    },
    PS384: {
      kty: "RSA",
      params: { name: "RSA-PSS", hash: "SHA-384", saltLength: 48 }
    },
    PS512: {
      kty: "RSA",
      params: { name: "RSA-PSS", hash: "SHA-512", saltLength: 64 }
    },
    RS256: {
      kty: "RSA",
      params: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }
    },
    RS384: {
      kty: "RSA",
      params: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-384" }
    },
    RS512: {
      kty: "RSA",
      params: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-512" }
    }
  };
  var SUPPORTED_ALGORITHMS = Object.freeze(Object.keys(FULLY_SPECIFIED_ALGORITHMS));
  var POLYMORPHIC_ALGORITHMS = /* @__PURE__ */ new Set(["EdDSA"]);
  var SYMMETRIC_ALGORITHMS = /* @__PURE__ */ new Set([
    "HS256",
    "HS384",
    "HS512",
    "hmac-sha256"
  ]);
  var UNIMPLEMENTED_ALGORITHMS = /* @__PURE__ */ new Set([
    "ML-DSA-44",
    "ML-DSA-65",
    "ML-DSA-87"
  ]);
  var REQUIRED_MEMBERS = {
    OKP: ["crv", "x"],
    EC: ["crv", "x", "y"],
    RSA: ["n", "e"]
  };
  function determineAlgorithm(jwk) {
    if (!jwk || typeof jwk !== "object") {
      throw invalidKey("JWK is not an object");
    }
    if (!jwk.kty) {
      throw invalidKey("JWK missing required member: kty");
    }
    if (jwk.kty === "oct") {
      throw invalidKey('Symmetric keys are not permitted: kty "oct" names a shared secret');
    }
    const alg = jwk.alg;
    if (!alg) {
      throw invalidKey("JWK missing required member: alg. The algorithm is taken from the key and is not derived from kty and crv");
    }
    if (SYMMETRIC_ALGORITHMS.has(alg)) {
      throw invalidKey(`Symmetric algorithms are not permitted: "${alg}" names a shared secret`);
    }
    if (POLYMORPHIC_ALGORITHMS.has(alg)) {
      throw invalidKey(`Polymorphic algorithm identifier "${alg}" is not permitted. Use a fully-specified identifier such as Ed25519 or Ed448 (RFC 9864)`);
    }
    if (jwk.kty === "AKP" || UNIMPLEMENTED_ALGORITHMS.has(alg)) {
      throw unsupportedAlgorithm(`Algorithm "${alg}" (kty "${jwk.kty}") is not implemented by this verifier`);
    }
    const spec = FULLY_SPECIFIED_ALGORITHMS[alg];
    if (!spec) {
      throw unsupportedAlgorithm(`Unsupported or not fully-specified algorithm: "${alg}"`);
    }
    if (jwk.kty !== spec.kty) {
      throw invalidKey(`JWK kty "${jwk.kty}" is inconsistent with alg "${alg}", which requires kty "${spec.kty}"`);
    }
    if (spec.crv && jwk.crv !== spec.crv) {
      throw invalidKey(`JWK crv "${jwk.crv}" is inconsistent with alg "${alg}", which requires crv "${spec.crv}"`);
    }
    for (const member of REQUIRED_MEMBERS[spec.kty] ?? []) {
      if (!jwk[member]) {
        throw invalidKey(`${spec.kty} JWK missing required member: ${member}`);
      }
    }
    return spec.params;
  }
  function getAlgorithmFromJwk(jwk) {
    return determineAlgorithm(jwk);
  }
  function validateJwk(jwk) {
    determineAlgorithm(jwk);
  }
  function withoutAlg(jwk) {
    const { alg: _alg, ...rest } = jwk;
    return rest;
  }
  async function importPrivateKey(jwk) {
    const algorithm = determineAlgorithm(jwk);
    return await crypto.subtle.importKey("jwk", withoutAlg(jwk), algorithm, false, ["sign"]);
  }
  function getPublicJwk(privateJwk) {
    const { d, p, q, dp, dq, qi, ...publicJwk2 } = privateJwk;
    return publicJwk2;
  }
  async function sign(data, privateKey, algorithm) {
    const signature = await crypto.subtle.sign(algorithm, privateKey, data);
    return new Uint8Array(signature);
  }

  // node_modules/@hellocoop/httpsig/dist/esm/fetch.js
  init_signature();
  function getContentTypeFromBody(body) {
    if (body === null || body === void 0) {
      return null;
    }
    if (body instanceof URLSearchParams) {
      return "application/x-www-form-urlencoded;charset=UTF-8";
    }
    if (typeof FormData !== "undefined" && body instanceof FormData) {
      return null;
    }
    if (typeof Blob !== "undefined" && body instanceof Blob) {
      return body.type || "application/octet-stream";
    }
    if (typeof body === "string") {
      return "text/plain;charset=UTF-8";
    }
    return "application/octet-stream";
  }
  function isDigestibleBody(body) {
    return typeof body === "string" || body instanceof Uint8Array || body instanceof ArrayBuffer || Buffer.isBuffer(body);
  }
  function validateComponents(components, headers) {
    for (const component of components) {
      if (component === "@signature-params" || component === "signature-key" || component === "signature-input" || component === "signature") {
        continue;
      }
      if (component.startsWith("@")) {
        if (!VALID_DERIVED_COMPONENTS.includes(component)) {
          throw new Error(`Invalid derived component: ${component}`);
        }
      } else {
        if (!headers.has(component)) {
          throw new Error(`Component "${component}" specified but header not found in request`);
        }
      }
    }
  }
  async function fetch2(url, options) {
    const { signingKey, signingCryptoKey, signatureKey, label = "sig", components: customComponents, contentDigest = "auto", dryRun = false, returnSent = false, method = "GET", headers: inputHeaders = {}, body, ...fetchOptions } = options;
    validateJwk(signingKey);
    let privateKey;
    let algorithm;
    if (signingKey.d) {
      privateKey = await importPrivateKey(signingKey);
      algorithm = getAlgorithmFromJwk(signingKey);
    } else {
      if (!signingCryptoKey) {
        throw new Error("signingCryptoKey is required when signingKey does not contain private key material");
      }
      privateKey = signingCryptoKey;
      algorithm = getAlgorithmFromJwk(signingKey);
    }
    const publicJwk2 = getPublicJwk(signingKey);
    const urlObj = typeof url === "string" ? new URL(url) : url;
    const targetUri = urlObj.href;
    const headers = new Headers(inputHeaders);
    let components;
    if (customComponents) {
      components = [...new Set(customComponents)];
    } else {
      const hasBody = body !== void 0 && body !== null;
      components = hasBody ? [...DEFAULT_COMPONENTS_BODY] : [...DEFAULT_COMPONENTS_GET];
    }
    if (body !== void 0 && body !== null && contentDigest !== "omit") {
      const digestible = isDigestibleBody(body);
      if (!digestible && contentDigest === "require") {
        throw new Error('contentDigest is "require" but the body cannot be digested: only string, Uint8Array, ArrayBuffer, and Buffer bodies have their exact bytes available to hash');
      }
      if (digestible && !components.includes("content-digest")) {
        components.push("content-digest");
      }
    }
    const componentValues = /* @__PURE__ */ new Map();
    if (body !== void 0 && body !== null) {
      if (!headers.has("content-type")) {
        const autoContentType = getContentTypeFromBody(body);
        if (autoContentType !== null) {
          headers.set("content-type", autoContentType);
        }
      }
      if (components.includes("content-digest")) {
        const contentDigest2 = await generateContentDigest(body);
        headers.set("content-digest", contentDigest2);
      }
    }
    if (components.includes("signature-key")) {
      const signatureKeyHeader = generateSignatureKeyHeader(label, signatureKey, publicJwk2);
      headers.set("signature-key", signatureKeyHeader);
    }
    validateComponents(components, headers);
    for (const component of components) {
      if (component.startsWith("@")) {
        switch (component) {
          case "@method":
            componentValues.set("@method", method.toUpperCase());
            break;
          case "@target-uri":
            componentValues.set("@target-uri", targetUri);
            break;
          case "@authority":
            componentValues.set("@authority", urlObj.host);
            break;
          case "@scheme":
            componentValues.set("@scheme", urlObj.protocol.replace(":", ""));
            break;
          case "@request-target":
            componentValues.set("@request-target", `${urlObj.pathname}${urlObj.search}`);
            break;
          case "@path":
            componentValues.set("@path", urlObj.pathname);
            break;
          case "@query":
            componentValues.set("@query", urlObj.search ? urlObj.search.substring(1) : "");
            break;
          default:
            throw new Error(`Unsupported derived component: ${component}`);
        }
      } else {
        const value = headers.get(component);
        if (value !== null) {
          componentValues.set(component, value);
        }
      }
    }
    const created = Math.floor(Date.now() / 1e3);
    const signatureInputHeader = generateSignatureInputHeader(label, components, created);
    headers.set("signature-input", signatureInputHeader);
    componentValues.set("@signature-params", generateSignatureParams(components, created));
    components.push("@signature-params");
    const signatureBase = generateSignatureBase(components, componentValues);
    const signatureBaseBytes = new TextEncoder().encode(signatureBase);
    const signature = await sign(signatureBaseBytes, privateKey, algorithm);
    const signatureHeader = generateSignatureHeader(label, signature);
    headers.set("signature", signatureHeader);
    if (dryRun) {
      return { headers };
    }
    const response = await globalThis.fetch(urlObj, {
      ...fetchOptions,
      method,
      headers,
      body
    });
    if (returnSent) {
      return {
        response,
        sent: {
          method,
          url: urlObj.href,
          headers,
          body: body ?? null
        }
      };
    }
    return response;
  }

  // node_modules/@hellocoop/httpsig/dist/esm/verify.js
  init_signature();
  init_structured_fields();
  init_base64();

  // node_modules/@hellocoop/httpsig/dist/esm/utils/thumbprint.js
  init_base64();

  // node_modules/@hellocoop/httpsig/dist/esm/utils/cache.js
  var DEFAULT_MAX_ENTRIES = 100;
  var BoundedTtlCache = class {
    entries = /* @__PURE__ */ new Map();
    maxEntries;
    constructor(maxEntries = DEFAULT_MAX_ENTRIES) {
      if (!Number.isInteger(maxEntries) || maxEntries < 1) {
        throw new Error("maxEntries must be a positive integer");
      }
      this.maxEntries = maxEntries;
    }
    get size() {
      return this.entries.size;
    }
    get(key) {
      const entry = this.entries.get(key);
      if (!entry) {
        return void 0;
      }
      if (entry.expiresAt <= Date.now()) {
        this.entries.delete(key);
        return void 0;
      }
      this.entries.delete(key);
      this.entries.set(key, entry);
      return entry.value;
    }
    set(key, value, ttlMs) {
      this.entries.delete(key);
      if (this.entries.size >= this.maxEntries) {
        this.evictOne();
      }
      this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
    }
    clear() {
      this.entries.clear();
    }
    /**
     * Drop an expired entry if there is one, otherwise the least recently
     * used. Preferring expired entries keeps live ones around longer without
     * changing the bound.
     */
    evictOne() {
      const now = Date.now();
      for (const [key, entry] of this.entries) {
        if (entry.expiresAt <= now) {
          this.entries.delete(key);
          return;
        }
      }
      const oldest = this.entries.keys().next();
      if (!oldest.done) {
        this.entries.delete(oldest.value);
      }
    }
  };

  // node_modules/@hellocoop/httpsig/dist/esm/verify.js
  init_errors();
  var jwksCache = new BoundedTtlCache();

  // node_modules/@hellocoop/httpsig/dist/esm/index.js
  init_signature();
  init_structured_fields();
  init_errors();

  // client/registry.js
  var ORIGIN = location.origin;
  var PS_DEFAULT = "https://person.hello.coop";
  var AGENT_TOKEN_KEY = "registry-agent-token";
  var DB_NAME = "registry-agent";
  var STORE = "keys";
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function idbGet(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const rq = tx.objectStore(STORE).get(key);
      rq.onsuccess = () => resolve(rq.result ?? null);
      rq.onerror = () => reject(rq.error);
    });
  }
  async function idbPut(key, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  var keyPairPromise = null;
  function getKeyPair() {
    if (!keyPairPromise) {
      keyPairPromise = (async () => {
        let kp = await idbGet("agent");
        if (!kp) {
          kp = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);
          await idbPut("agent", kp);
        }
        return kp;
      })();
    }
    return keyPairPromise;
  }
  var getAgentToken = () => localStorage.getItem(AGENT_TOKEN_KEY);
  var setAgentToken = (t) => localStorage.setItem(AGENT_TOKEN_KEY, t);
  async function publicJwk(kp) {
    const jwk = await crypto.subtle.exportKey("jwk", kp.publicKey);
    jwk.alg = "Ed25519";
    return jwk;
  }
  async function signedFetch(url, { method = "GET", body, jwt, headers = {} } = {}) {
    const kp = await getKeyPair();
    const pub = await publicJwk(kp);
    const hasBody = body != null;
    return fetch2(url, {
      method,
      headers: hasBody ? { "Content-Type": "application/json", ...headers } : headers,
      body: hasBody ? body : void 0,
      signingKey: pub,
      signingCryptoKey: kp.privateKey,
      signatureKey: { type: "jwt", jwt }
    });
  }
  async function bootstrap() {
    const kp = await getKeyPair();
    const pub = await publicJwk(kp);
    const response = await fetch2(`${ORIGIN}/bootstrap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ps: PS_DEFAULT }),
      signingKey: pub,
      signingCryptoKey: kp.privateKey,
      signatureKey: { type: "hwk" }
    });
    const data = await response.json();
    if (!response.ok || !data.agent_token) throw new Error(data.error || "bootstrap failed");
    setAgentToken(data.agent_token);
    return data.agent_token;
  }
  function agentTokenFresh() {
    const t = getAgentToken();
    if (!t) return false;
    try {
      const p = JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      return typeof p.exp === "number" && p.exp > Math.floor(Date.now() / 1e3) + 30;
    } catch {
      return false;
    }
  }
  async function ensureAgentToken() {
    if (!agentTokenFresh()) await bootstrap();
    return getAgentToken();
  }
  var PENDING_KEY = "registry-pending";
  var savePending = (p) => localStorage.setItem(PENDING_KEY, JSON.stringify(p));
  var clearPending = () => localStorage.removeItem(PENDING_KEY);
  function loadPending() {
    try {
      return JSON.parse(localStorage.getItem(PENDING_KEY) || "null");
    } catch {
      return null;
    }
  }
  function parseRequirement(h) {
    const out = {};
    (h || "").split(";").forEach((part) => {
      const m = part.trim().match(/^([a-z0-9-]+)=(?:"([^"]*)"|(\S+))$/i);
      if (m) out[m[1].toLowerCase()] = m[2] ?? m[3];
    });
    return out;
  }
  async function deferToPersonServer(psRes, psMeta, pending, stage) {
    const body = await psRes.json().catch(() => ({}));
    const req = parseRequirement(psRes.headers.get("aauth-requirement"));
    const interactionUrl = req.url || body.url || psMeta.interaction_endpoint;
    const code = req.code || body.code;
    const pollUrl = new URL(psRes.headers.get("location") || body.location, PS_DEFAULT).toString();
    savePending({ ...pending, stage, pollUrl });
    window.location.href = `${interactionUrl}?code=${encodeURIComponent(code)}&callback=${encodeURIComponent(ORIGIN + "/")}`;
    return { redirecting: true };
  }
  async function obtainPersonToken(agentToken, psMeta, pending) {
    if (!psMeta.person_token_endpoint) throw new Error("PS publishes no person_token_endpoint");
    const res = await signedFetch(psMeta.person_token_endpoint, {
      method: "POST",
      jwt: agentToken,
      body: JSON.stringify({ resource: ORIGIN })
    });
    if (res.status === 200) {
      const body = await res.json();
      if (!body.person_token) throw new Error("PS returned no person_token");
      return { personToken: body.person_token };
    }
    if (res.status === 202) return deferToPersonServer(res, psMeta, pending, "person");
    throw new Error(`PS person token endpoint ${res.status}`);
  }
  async function resourceTokenFor(personToken) {
    const res = await signedFetch(`${ORIGIN}/auth/identity`, { jwt: personToken });
    if (res.status !== 401) throw new Error(`expected an auth-token challenge, got ${res.status}`);
    const rt = parseRequirement(res.headers.get("aauth-requirement"))["resource-token"];
    if (!rt) throw new Error("no resource_token in challenge");
    return rt;
  }
  async function obtainAuthToken(agentToken, psMeta, resourceToken, pending) {
    const res = await signedFetch(psMeta.auth_token_endpoint, {
      method: "POST",
      jwt: agentToken,
      body: JSON.stringify({ resource_token: resourceToken, capabilities: ["interaction"], prompt: "consent" })
    });
    if (res.status === 200) {
      const body = await res.json();
      if (!body.auth_token) throw new Error("PS returned no auth_token");
      return { authToken: body.auth_token };
    }
    if (res.status === 202) return deferToPersonServer(res, psMeta, pending, "auth");
    throw new Error(`PS auth token endpoint ${res.status}`);
  }
  async function startAuthFlow(pending) {
    const agentToken = await ensureAgentToken();
    const psMeta = await (await fetch(`${PS_DEFAULT}/.well-known/aauth-person.json`)).json();
    const person = await obtainPersonToken(agentToken, psMeta, pending);
    if (person.redirecting) return person;
    return finishAfterPersonToken(person.personToken, agentToken, psMeta, pending);
  }
  async function finishAfterPersonToken(personToken, agentToken, psMeta, pending) {
    const resourceToken = await resourceTokenFor(personToken);
    return obtainAuthToken(agentToken, psMeta, resourceToken, pending);
  }
  async function pollForToken(pollUrl, agentToken, field, maxCycles = 40) {
    for (let i = 0; i < maxCycles; i++) {
      const res = await signedFetch(pollUrl, { jwt: agentToken, headers: { Prefer: "wait=30" } });
      if (res.status === 200) {
        const body = await res.json();
        if (body[field]) return body[field];
      } else if (res.status === 403 || res.status === 404 || res.status === 408) {
        throw new Error(`consent ${res.status}`);
      }
      await new Promise((r) => setTimeout(r, 2e3));
    }
    throw new Error("sign-in timed out");
  }
  async function completeWithAuthToken(authToken, pending) {
    if (pending.kind === "add") {
      const res2 = await signedFetch(`${ORIGIN}/resources`, {
        method: "POST",
        jwt: authToken,
        body: JSON.stringify({ issuer: pending.issuer })
      });
      return { status: res2.status, data: await res2.json().catch(() => ({})) };
    }
    const res = await signedFetch(`${ORIGIN}/auth/identity`, { jwt: authToken });
    if (!res.ok) throw new Error(`login retry ${res.status}`);
    return res.json();
  }
  async function resumePending() {
    const pending = loadPending();
    if (!pending) return false;
    clearPending();
    $("status").innerHTML = '<span class="who">Finishing sign-in\u2026</span>';
    $("resources").innerHTML = "";
    try {
      const agentToken = getAgentToken();
      if (!agentToken) throw new Error("agent token missing after redirect");
      if (pending.stage === "person") {
        const personToken = await pollForToken(pending.pollUrl, agentToken, "person_token");
        const psMeta = await (await fetch(`${PS_DEFAULT}/.well-known/aauth-person.json`)).json();
        const r = await finishAfterPersonToken(personToken, agentToken, psMeta, pending);
        if (r.redirecting) return true;
        await completeWithAuthToken(r.authToken, pending);
      } else {
        const authToken = await pollForToken(pending.pollUrl, agentToken, "auth_token");
        await completeWithAuthToken(authToken, pending);
      }
    } catch (err) {
      console.error("resume failed", err);
    }
    return true;
  }
  async function listResources() {
    const agentToken = await ensureAgentToken();
    const res = await signedFetch(`${ORIGIN}/resources`, { jwt: agentToken });
    if (!res.ok) throw new Error(`list ${res.status}`);
    return res.json();
  }
  async function addResource(issuer) {
    const agentToken = await ensureAgentToken();
    const res = await signedFetch(`${ORIGIN}/resources`, {
      method: "POST",
      jwt: agentToken,
      body: JSON.stringify({ issuer })
    });
    if (res.status === 401 && res.headers.get("aauth-requirement")) {
      const r = await startAuthFlow({ kind: "add", issuer });
      if (r.redirecting) return { redirecting: true };
      return completeWithAuthToken(r.authToken, { kind: "add", issuer });
    }
    return { status: res.status, data: await res.json().catch(() => ({})) };
  }
  var getSession = () => fetch(`${ORIGIN}/auth/session`).then((r) => r.json());
  var logout = () => fetch(`${ORIGIN}/auth/logout`, { method: "POST" }).then(() => {
  });
  var $ = (id) => document.getElementById(id);
  var esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  var ACCESS_MODE_TITLES = {
    "agent-token": "Authorizes on the agent\u2019s identity alone",
    "person-token": "Authorizes on the person\u2019s identity alone",
    "session-token": "Runs its own authorization and issues a session token",
    "auth-token": "Needs an auth token from your person server",
    "per-call": "Authorizes each call individually, against that call\u2019s parameters"
  };
  var accessModeTitle = (mode) => ACCESS_MODE_TITLES[mode] ?? (mode ? `Access mode \u201C${mode}\u201D \u2014 not one this page knows; agents call the resource and read its AAuth-Requirement` : "No access mode declared \u2014 defaults to agent-token");
  function renderResources(index) {
    const list = $("resources");
    const items = index.resources || [];
    if (!items.length) {
      list.innerHTML = '<p class="muted">No resources yet. Be the first to add one.</p>';
      return;
    }
    list.innerHTML = items.map(
      (r) => `
    <div class="card">
      <div class="card-head">
        <a class="name" href="${esc(r.issuer)}" target="_blank" rel="noopener">${esc(r.name)}</a>
        <span class="badge" title="${esc(accessModeTitle(r.access_mode))}">${esc(r.access_mode || "agent-token")}</span>
      </div>
      <p class="desc">${esc(r.description)}</p>
      <div class="host">${esc(r.issuer)}</div>
    </div>`
    ).join("");
  }
  function setStatus(session) {
    const bar = $("status");
    if (session && session.logged_in) {
      const who = session.name || session.email || session.sub;
      bar.innerHTML = `<span class="who">Signed in as <b>${esc(who)}</b>${session.email ? ` (${esc(session.email)})` : ""}</span> <button id="logout" class="link">Log out</button>`;
      $("logout").onclick = async () => {
        await logout();
        refresh();
      };
    } else {
      bar.innerHTML = `<button id="login" class="btn">\u014D&nbsp; Log in with Hell\u014D</button>`;
      $("login").onclick = doLogin;
    }
  }
  async function doLogin() {
    $("login").disabled = true;
    $("login").textContent = "Connecting to Hell\u014D\u2026";
    try {
      const r = await startAuthFlow({ kind: "login" });
      if (r.redirecting) return;
      await completeWithAuthToken(r.authToken, { kind: "login" });
      await refresh();
    } catch (err) {
      alert(`Login failed: ${err.message}`);
      refresh();
    }
  }
  async function doAdd() {
    const input = $("issuer");
    const issuer = input.value.trim();
    if (!issuer) return;
    const btn = $("add-btn");
    btn.disabled = true;
    $("add-result").textContent = "Adding\u2026";
    try {
      const out = await addResource(issuer);
      if (out.redirecting) return;
      const { status, data } = out;
      if (status === 201) $("add-result").textContent = `\u2713 Added ${data.resource?.name || issuer}`;
      else if (status === 200) $("add-result").textContent = `Already in the registry.`;
      else $("add-result").textContent = `Couldn't add: ${(data.errors || [data.error]).join(", ")}`;
      input.value = "";
      await refresh();
    } catch (err) {
      $("add-result").textContent = `Error: ${err.message}`;
    } finally {
      btn.disabled = false;
    }
  }
  async function refresh() {
    let session;
    try {
      session = await getSession();
    } catch {
      session = { logged_in: false };
    }
    setStatus(session);
    const loggedIn = !!(session && session.logged_in);
    $("add-section").classList.toggle("hidden", !loggedIn);
    if (!loggedIn) {
      $("resources").innerHTML = '<p class="muted">Log in to browse the registry.</p>';
      return;
    }
    try {
      const index = await listResources();
      renderResources(index);
    } catch (err) {
      $("resources").innerHTML = `<p class="muted">Couldn't load: ${esc(err.message)}</p>`;
    }
  }
  window.addEventListener("DOMContentLoaded", async () => {
    $("add-btn").onclick = doAdd;
    $("issuer").addEventListener("keydown", (e) => {
      if (e.key === "Enter") doAdd();
    });
    await resumePending();
    refresh();
  });
})();
