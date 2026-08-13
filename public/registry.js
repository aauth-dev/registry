"use strict";
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // node_modules/@hellocoop/httpsig/dist/types.js
  var require_types = __commonJS({
    "node_modules/@hellocoop/httpsig/dist/types.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.DEFAULT_COMPONENTS_BODY = exports.DEFAULT_COMPONENTS_GET = exports.VALID_DERIVED_COMPONENTS = void 0;
      exports.VALID_DERIVED_COMPONENTS = [
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
      exports.DEFAULT_COMPONENTS_GET = [
        "@method",
        "@authority",
        "@path",
        "signature-key"
      ];
      exports.DEFAULT_COMPONENTS_BODY = [
        "@method",
        "@authority",
        "@path",
        "content-type",
        "signature-key"
      ];
    }
  });

  // node_modules/@hellocoop/httpsig/dist/errors.js
  var require_errors = __commonJS({
    "node_modules/@hellocoop/httpsig/dist/errors.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.SignatureVerificationError = void 0;
      exports.invalidKey = invalidKey;
      exports.unsupportedAlgorithm = unsupportedAlgorithm;
      exports.unsupportedScheme = unsupportedScheme;
      exports.invalidJwt = invalidJwt;
      exports.issuerMissing = issuerMissing;
      exports.issuerMismatch = issuerMismatch;
      exports.expiredJwt = expiredJwt;
      exports.invalidInput = invalidInput;
      var SignatureVerificationError = class extends Error {
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
      exports.SignatureVerificationError = SignatureVerificationError;
      function invalidKey(message) {
        return new SignatureVerificationError("invalid_key", message);
      }
      function unsupportedAlgorithm(message, supportedAlgorithms) {
        return new SignatureVerificationError("unsupported_algorithm", message, {
          supportedAlgorithms
        });
      }
      function unsupportedScheme(message) {
        return new SignatureVerificationError("unsupported_scheme", message);
      }
      function invalidJwt(message) {
        return new SignatureVerificationError("invalid_jwt", message);
      }
      function issuerMissing(message) {
        return new SignatureVerificationError("issuer_missing", message);
      }
      function issuerMismatch(message) {
        return new SignatureVerificationError("issuer_mismatch", message);
      }
      function expiredJwt(message) {
        return new SignatureVerificationError("expired_jwt", message);
      }
      function invalidInput(message, requiredInput) {
        return new SignatureVerificationError("invalid_input", message, {
          requiredInput
        });
      }
    }
  });

  // node_modules/@hellocoop/httpsig/dist/utils/crypto.js
  var require_crypto = __commonJS({
    "node_modules/@hellocoop/httpsig/dist/utils/crypto.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.UNIMPLEMENTED_ALGORITHMS = exports.SYMMETRIC_ALGORITHMS = exports.POLYMORPHIC_ALGORITHMS = exports.SUPPORTED_ALGORITHMS = exports.FULLY_SPECIFIED_ALGORITHMS = void 0;
      exports.determineAlgorithm = determineAlgorithm;
      exports.getAlgorithmFromJwk = getAlgorithmFromJwk;
      exports.validateJwk = validateJwk;
      exports.importPrivateKey = importPrivateKey;
      exports.importPublicKey = importPublicKey;
      exports.getPublicJwk = getPublicJwk;
      exports.sign = sign;
      exports.verify = verify;
      exports.generateKeyPair = generateKeyPair;
      var errors_js_1 = require_errors();
      exports.FULLY_SPECIFIED_ALGORITHMS = {
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
      exports.SUPPORTED_ALGORITHMS = Object.freeze(Object.keys(exports.FULLY_SPECIFIED_ALGORITHMS));
      exports.POLYMORPHIC_ALGORITHMS = /* @__PURE__ */ new Set(["EdDSA"]);
      exports.SYMMETRIC_ALGORITHMS = /* @__PURE__ */ new Set([
        "HS256",
        "HS384",
        "HS512",
        "hmac-sha256"
      ]);
      exports.UNIMPLEMENTED_ALGORITHMS = /* @__PURE__ */ new Set([
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
          throw (0, errors_js_1.invalidKey)("JWK is not an object");
        }
        if (!jwk.kty) {
          throw (0, errors_js_1.invalidKey)("JWK missing required member: kty");
        }
        if (jwk.kty === "oct") {
          throw (0, errors_js_1.invalidKey)('Symmetric keys are not permitted: kty "oct" names a shared secret');
        }
        const alg = jwk.alg;
        if (!alg) {
          throw (0, errors_js_1.invalidKey)("JWK missing required member: alg. The algorithm is taken from the key and is not derived from kty and crv");
        }
        if (exports.SYMMETRIC_ALGORITHMS.has(alg)) {
          throw (0, errors_js_1.invalidKey)(`Symmetric algorithms are not permitted: "${alg}" names a shared secret`);
        }
        if (exports.POLYMORPHIC_ALGORITHMS.has(alg)) {
          throw (0, errors_js_1.invalidKey)(`Polymorphic algorithm identifier "${alg}" is not permitted. Use a fully-specified identifier such as Ed25519 or Ed448 (RFC 9864)`);
        }
        if (jwk.kty === "AKP" || exports.UNIMPLEMENTED_ALGORITHMS.has(alg)) {
          throw (0, errors_js_1.unsupportedAlgorithm)(`Algorithm "${alg}" (kty "${jwk.kty}") is not implemented by this verifier`);
        }
        const spec = exports.FULLY_SPECIFIED_ALGORITHMS[alg];
        if (!spec) {
          throw (0, errors_js_1.unsupportedAlgorithm)(`Unsupported or not fully-specified algorithm: "${alg}"`);
        }
        if (jwk.kty !== spec.kty) {
          throw (0, errors_js_1.invalidKey)(`JWK kty "${jwk.kty}" is inconsistent with alg "${alg}", which requires kty "${spec.kty}"`);
        }
        if (spec.crv && jwk.crv !== spec.crv) {
          throw (0, errors_js_1.invalidKey)(`JWK crv "${jwk.crv}" is inconsistent with alg "${alg}", which requires crv "${spec.crv}"`);
        }
        for (const member of REQUIRED_MEMBERS[spec.kty] ?? []) {
          if (!jwk[member]) {
            throw (0, errors_js_1.invalidKey)(`${spec.kty} JWK missing required member: ${member}`);
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
      async function importPublicKey(jwk) {
        const algorithm = determineAlgorithm(jwk);
        return await crypto.subtle.importKey("jwk", withoutAlg(jwk), algorithm, false, ["verify"]);
      }
      function getPublicJwk(privateJwk) {
        const { d, p, q, dp, dq, qi, ...publicJwk2 } = privateJwk;
        return publicJwk2;
      }
      async function sign(data, privateKey, algorithm) {
        const signature = await crypto.subtle.sign(algorithm, privateKey, data);
        return new Uint8Array(signature);
      }
      async function verify(data, signature, publicKey, algorithm) {
        return await crypto.subtle.verify(algorithm, publicKey, signature, data);
      }
      async function generateKeyPair(options) {
        const algorithm = options?.algorithm ?? "Ed25519";
        const extractable = options?.extractable ?? true;
        const spec = exports.FULLY_SPECIFIED_ALGORITHMS[algorithm];
        if (!spec) {
          throw new Error(`Unsupported algorithm: ${algorithm}`);
        }
        const genAlgorithm = spec.crv ? spec.params.name === "ECDSA" ? { name: "ECDSA", namedCurve: spec.crv } : { name: spec.params.name } : { name: spec.params.name };
        const keyPair = await crypto.subtle.generateKey(genAlgorithm, extractable, ["sign", "verify"]);
        const publicKey = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
        publicKey.alg = algorithm;
        return {
          privateKey: keyPair.privateKey,
          publicKey
        };
      }
    }
  });

  // node_modules/@hellocoop/httpsig/dist/utils/base64.js
  var require_base64 = __commonJS({
    "node_modules/@hellocoop/httpsig/dist/utils/base64.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.base64urlEncode = base64urlEncode;
      exports.base64urlDecode = base64urlDecode;
      exports.base64Encode = base64Encode;
      exports.base64Decode = base64Decode;
      exports.sha256 = sha256;
      exports.sha512 = sha512;
      function bytesToBase64(bytes) {
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
      }
      function base64ToBytes(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
      }
      function base64urlEncode(data) {
        const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
        const base64 = bytesToBase64(bytes);
        return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
      }
      function base64urlDecode(data) {
        let padded = data;
        const padding = (4 - data.length % 4) % 4;
        if (padding > 0) {
          padded += "=".repeat(padding);
        }
        const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
        return base64ToBytes(base64);
      }
      function base64Encode(data) {
        const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
        return bytesToBase64(bytes);
      }
      function base64Decode(data) {
        return base64ToBytes(data);
      }
      async function sha256(data) {
        const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
        const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
        return new Uint8Array(hashBuffer);
      }
      async function sha512(data) {
        const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
        const hashBuffer = await crypto.subtle.digest("SHA-512", bytes);
        return new Uint8Array(hashBuffer);
      }
    }
  });

  // node_modules/@hellocoop/httpsig/dist/vendor/structured-headers/types.js
  var require_types2 = __commonJS({
    "node_modules/@hellocoop/httpsig/dist/vendor/structured-headers/types.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.ByteSequence = void 0;
      var ByteSequence = class {
        base64Value;
        constructor(base64Value) {
          this.base64Value = base64Value;
        }
        toBase64() {
          return this.base64Value;
        }
      };
      exports.ByteSequence = ByteSequence;
    }
  });

  // node_modules/@hellocoop/httpsig/dist/vendor/structured-headers/util.js
  var require_util = __commonJS({
    "node_modules/@hellocoop/httpsig/dist/vendor/structured-headers/util.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.isAscii = isAscii;
      exports.isValidTokenStr = isValidTokenStr;
      exports.isValidKeyStr = isValidKeyStr;
      exports.isInnerList = isInnerList;
      exports.isByteSequence = isByteSequence;
      var asciiRe = /^[\x20-\x7E]*$/;
      var tokenRe = /^[a-zA-Z*][:/!#$%&'*+\-.^_`|~A-Za-z0-9]*$/;
      var keyRe = /^[a-z*][*\-_.a-z0-9]*$/;
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
      function isByteSequence(input) {
        return typeof input === "object" && "base64Value" in input;
      }
    }
  });

  // node_modules/@hellocoop/httpsig/dist/vendor/structured-headers/token.js
  var require_token = __commonJS({
    "node_modules/@hellocoop/httpsig/dist/vendor/structured-headers/token.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Token = void 0;
      var util_js_1 = require_util();
      var Token = class {
        value;
        constructor(value) {
          if (!(0, util_js_1.isValidTokenStr)(value)) {
            throw new TypeError("Invalid character in Token string. Tokens must start with *, A-Z and the rest of the string may only contain a-z, A-Z, 0-9, :/!#$%&'*+-.^_`|~");
          }
          this.value = value;
        }
        toString() {
          return this.value;
        }
      };
      exports.Token = Token;
    }
  });

  // node_modules/@hellocoop/httpsig/dist/vendor/structured-headers/parser.js
  var require_parser = __commonJS({
    "node_modules/@hellocoop/httpsig/dist/vendor/structured-headers/parser.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.ParseError = void 0;
      exports.parseDictionary = parseDictionary;
      exports.parseList = parseList;
      exports.parseItem = parseItem;
      var types_js_1 = require_types2();
      var token_js_1 = require_token();
      var util_js_1 = require_util();
      function parseDictionary(input) {
        const parser = new Parser(input);
        return parser.parseDictionary();
      }
      function parseList(input) {
        const parser = new Parser(input);
        return parser.parseList();
      }
      function parseItem(input) {
        const parser = new Parser(input);
        return parser.parseItem();
      }
      var ParseError = class extends Error {
        constructor(position, message) {
          super(`Parse error: ${message} at offset ${position}`);
        }
      };
      exports.ParseError = ParseError;
      var Parser = class {
        input;
        pos;
        constructor(input) {
          this.input = input;
          this.pos = 0;
        }
        parseDictionary() {
          this.skipWS();
          const dictionary = /* @__PURE__ */ new Map();
          while (!this.eof()) {
            const thisKey = this.parseKey();
            let member;
            if (this.lookChar() === "=") {
              this.pos++;
              member = this.parseItemOrInnerList();
            } else {
              member = [true, this.parseParameters()];
            }
            dictionary.set(thisKey, member);
            this.skipOWS();
            if (this.eof()) {
              return dictionary;
            }
            this.expectChar(",");
            this.pos++;
            this.skipOWS();
            if (this.eof()) {
              throw new ParseError(this.pos, "Dictionary contained a trailing comma");
            }
          }
          return dictionary;
        }
        parseList() {
          this.skipWS();
          const members = [];
          while (!this.eof()) {
            members.push(this.parseItemOrInnerList());
            this.skipOWS();
            if (this.eof()) {
              return members;
            }
            this.expectChar(",");
            this.pos++;
            this.skipOWS();
            if (this.eof()) {
              throw new ParseError(this.pos, "A list may not end with a trailing comma");
            }
          }
          return members;
        }
        parseItem(standaloneItem = true) {
          if (standaloneItem)
            this.skipWS();
          const result = [this.parseBareItem(), this.parseParameters()];
          if (standaloneItem)
            this.checkTrail();
          return result;
        }
        parseItemOrInnerList() {
          if (this.lookChar() === "(") {
            return this.parseInnerList();
          } else {
            return this.parseItem(false);
          }
        }
        parseInnerList() {
          this.expectChar("(");
          this.pos++;
          const innerList = [];
          while (!this.eof()) {
            this.skipWS();
            if (this.lookChar() === ")") {
              this.pos++;
              return [innerList, this.parseParameters()];
            }
            innerList.push(this.parseItem(false));
            const nextChar = this.lookChar();
            if (nextChar !== " " && nextChar !== ")") {
              throw new ParseError(this.pos, "Expected a whitespace or ) after every item in an inner list");
            }
          }
          throw new ParseError(this.pos, "Could not find end of inner list");
        }
        parseBareItem() {
          const char = this.lookChar();
          if (char === void 0) {
            throw new ParseError(this.pos, "Unexpected end of string");
          }
          if (char.match(/^[-0-9]/)) {
            return this.parseIntegerOrDecimal();
          }
          if (char === '"') {
            return this.parseString();
          }
          if (char.match(/^[A-Za-z*]/)) {
            return this.parseToken();
          }
          if (char === ":") {
            return this.parseByteSequence();
          }
          if (char === "?") {
            return this.parseBoolean();
          }
          throw new ParseError(this.pos, "Unexpected input");
        }
        parseParameters() {
          const parameters = /* @__PURE__ */ new Map();
          while (!this.eof()) {
            const char = this.lookChar();
            if (char !== ";") {
              break;
            }
            this.pos++;
            this.skipWS();
            const key = this.parseKey();
            let value = true;
            if (this.lookChar() === "=") {
              this.pos++;
              value = this.parseBareItem();
            }
            parameters.set(key, value);
          }
          return parameters;
        }
        parseIntegerOrDecimal() {
          let type = "integer";
          let sign = 1;
          let inputNumber = "";
          if (this.lookChar() === "-") {
            sign = -1;
            this.pos++;
          }
          if (!isDigit(this.lookChar())) {
            throw new ParseError(this.pos, "Expected a digit (0-9)");
          }
          while (!this.eof()) {
            const char = this.getChar();
            if (isDigit(char)) {
              inputNumber += char;
            } else if (type === "integer" && char === ".") {
              if (inputNumber.length > 12) {
                throw new ParseError(this.pos, "Exceeded maximum decimal length");
              }
              inputNumber += ".";
              type = "decimal";
            } else {
              this.pos--;
              break;
            }
            if (type === "integer" && inputNumber.length > 15) {
              throw new ParseError(this.pos, "Exceeded maximum integer length");
            }
            if (type === "decimal" && inputNumber.length > 16) {
              throw new ParseError(this.pos, "Exceeded maximum decimal length");
            }
          }
          if (type === "integer") {
            return parseInt(inputNumber, 10) * sign;
          } else {
            if (inputNumber.endsWith(".")) {
              throw new ParseError(this.pos, "Decimal cannot end on a period");
            }
            if (inputNumber.split(".")[1].length > 3) {
              throw new ParseError(this.pos, "Number of digits after the decimal point cannot exceed 3");
            }
            return parseFloat(inputNumber) * sign;
          }
        }
        parseString() {
          let outputString = "";
          this.expectChar('"');
          this.pos++;
          while (!this.eof()) {
            const char = this.getChar();
            if (char === "\\") {
              if (this.eof()) {
                throw new ParseError(this.pos, "Unexpected end of input");
              }
              const nextChar = this.getChar();
              if (nextChar !== "\\" && nextChar !== '"') {
                throw new ParseError(this.pos, "A backslash must be followed by another backslash or double quote");
              }
              outputString += nextChar;
            } else if (char === '"') {
              return outputString;
            } else if (!(0, util_js_1.isAscii)(char)) {
              throw new ParseError(this.pos, "Strings must be in the ASCII range");
            } else {
              outputString += char;
            }
          }
          throw new ParseError(this.pos, "Unexpected end of input");
        }
        parseToken() {
          let outputString = "";
          while (!this.eof()) {
            const char = this.lookChar();
            if (char === void 0 || !/^[:/!#$%&'*+\-.^_`|~A-Za-z0-9]$/.test(char)) {
              return new token_js_1.Token(outputString);
            }
            outputString += this.getChar();
          }
          return new token_js_1.Token(outputString);
        }
        parseByteSequence() {
          this.expectChar(":");
          this.pos++;
          const endPos = this.input.indexOf(":", this.pos);
          if (endPos === -1) {
            throw new ParseError(this.pos, 'Could not find a closing ":" character to mark end of Byte Sequence');
          }
          const b64Content = this.input.substring(this.pos, endPos);
          this.pos += b64Content.length + 1;
          if (!/^[A-Za-z0-9+/=]*$/.test(b64Content)) {
            throw new ParseError(this.pos, "ByteSequence does not contain a valid base64 string");
          }
          return new types_js_1.ByteSequence(b64Content);
        }
        parseBoolean() {
          this.expectChar("?");
          this.pos++;
          const char = this.getChar();
          if (char === "1") {
            return true;
          }
          if (char === "0") {
            return false;
          }
          throw new ParseError(this.pos, 'Unexpected character. Expected a "1" or a "0"');
        }
        parseKey() {
          if (!this.lookChar()?.match(/^[a-z*]/)) {
            throw new ParseError(this.pos, "A key must begin with an asterisk or letter (a-z)");
          }
          let outputString = "";
          while (!this.eof()) {
            const char = this.lookChar();
            if (char === void 0 || !/^[a-z0-9_\-.*]$/.test(char)) {
              return outputString;
            }
            outputString += this.getChar();
          }
          return outputString;
        }
        /**
         * Looks at the next character without advancing the cursor.
         *
         * Returns undefined if we were at the end of the string.
         */
        lookChar() {
          return this.input[this.pos];
        }
        /**
         * Checks if the next character is 'char', and fail otherwise.
         */
        expectChar(char) {
          if (this.lookChar() !== char) {
            throw new ParseError(this.pos, `Expected ${char}`);
          }
        }
        getChar() {
          return this.input[this.pos++];
        }
        eof() {
          return this.pos >= this.input.length;
        }
        // Advances the pointer to skip all whitespace.
        skipOWS() {
          while (true) {
            const c = this.input.substr(this.pos, 1);
            if (c === " " || c === "	") {
              this.pos++;
            } else {
              break;
            }
          }
        }
        // Advances the pointer to skip all spaces
        skipWS() {
          while (this.lookChar() === " ") {
            this.pos++;
          }
        }
        // At the end of parsing, we need to make sure there are no bytes after the
        // header except whitespace.
        checkTrail() {
          this.skipWS();
          if (!this.eof()) {
            throw new ParseError(this.pos, "Unexpected characters at end of input");
          }
        }
      };
      exports.default = Parser;
      var isDigitRegex = /^[0-9]$/;
      function isDigit(char) {
        if (char === void 0)
          return false;
        return isDigitRegex.test(char);
      }
    }
  });

  // node_modules/@hellocoop/httpsig/dist/vendor/structured-headers/serializer.js
  var require_serializer = __commonJS({
    "node_modules/@hellocoop/httpsig/dist/vendor/structured-headers/serializer.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.SerializeError = void 0;
      exports.serializeList = serializeList;
      exports.serializeDictionary = serializeDictionary;
      exports.serializeItem = serializeItem;
      exports.serializeInnerList = serializeInnerList;
      exports.serializeBareItem = serializeBareItem;
      exports.serializeInteger = serializeInteger;
      exports.serializeDecimal = serializeDecimal;
      exports.serializeString = serializeString;
      exports.serializeBoolean = serializeBoolean;
      exports.serializeByteSequence = serializeByteSequence;
      exports.serializeToken = serializeToken;
      exports.serializeParameters = serializeParameters;
      exports.serializeKey = serializeKey;
      var types_js_1 = require_types2();
      var token_js_1 = require_token();
      var util_js_1 = require_util();
      var SerializeError = class extends Error {
      };
      exports.SerializeError = SerializeError;
      function serializeList(input) {
        return input.map((value) => {
          if ((0, util_js_1.isInnerList)(value)) {
            return serializeInnerList(value);
          } else {
            return serializeItem(value);
          }
        }).join(", ");
      }
      function serializeDictionary(input) {
        return Array.from(input.entries()).map(([key, value]) => {
          let out = serializeKey(key);
          if (value[0] === true) {
            out += serializeParameters(value[1]);
          } else {
            out += "=";
            if ((0, util_js_1.isInnerList)(value)) {
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
        if (input instanceof token_js_1.Token) {
          return serializeToken(input);
        }
        if (input instanceof types_js_1.ByteSequence) {
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
        if (!(0, util_js_1.isAscii)(input)) {
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
        if (!(0, util_js_1.isValidKeyStr)(input)) {
          throw new SerializeError("Keys in dictionaries must only contain lowercase letter, numbers, _-*. and must start with a letter or *");
        }
        return input;
      }
    }
  });

  // node_modules/@hellocoop/httpsig/dist/structured-fields.js
  var require_structured_fields = __commonJS({
    "node_modules/@hellocoop/httpsig/dist/structured-fields.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.isValidKeyStr = exports.isValidTokenStr = exports.isByteSequence = exports.isInnerList = exports.ByteSequence = exports.Token = exports.SerializeError = exports.serializeParameters = exports.serializeBareItem = exports.serializeInnerList = exports.serializeItem = exports.serializeList = exports.serializeDictionary = exports.ParseError = exports.parseItem = exports.parseList = exports.parseDictionary = void 0;
      exports.bareItemToString = bareItemToString;
      var parser_js_1 = require_parser();
      Object.defineProperty(exports, "parseDictionary", { enumerable: true, get: function() {
        return parser_js_1.parseDictionary;
      } });
      Object.defineProperty(exports, "parseList", { enumerable: true, get: function() {
        return parser_js_1.parseList;
      } });
      Object.defineProperty(exports, "parseItem", { enumerable: true, get: function() {
        return parser_js_1.parseItem;
      } });
      Object.defineProperty(exports, "ParseError", { enumerable: true, get: function() {
        return parser_js_1.ParseError;
      } });
      var serializer_js_1 = require_serializer();
      Object.defineProperty(exports, "serializeDictionary", { enumerable: true, get: function() {
        return serializer_js_1.serializeDictionary;
      } });
      Object.defineProperty(exports, "serializeList", { enumerable: true, get: function() {
        return serializer_js_1.serializeList;
      } });
      Object.defineProperty(exports, "serializeItem", { enumerable: true, get: function() {
        return serializer_js_1.serializeItem;
      } });
      Object.defineProperty(exports, "serializeInnerList", { enumerable: true, get: function() {
        return serializer_js_1.serializeInnerList;
      } });
      Object.defineProperty(exports, "serializeBareItem", { enumerable: true, get: function() {
        return serializer_js_1.serializeBareItem;
      } });
      Object.defineProperty(exports, "serializeParameters", { enumerable: true, get: function() {
        return serializer_js_1.serializeParameters;
      } });
      Object.defineProperty(exports, "SerializeError", { enumerable: true, get: function() {
        return serializer_js_1.SerializeError;
      } });
      var token_js_1 = require_token();
      Object.defineProperty(exports, "Token", { enumerable: true, get: function() {
        return token_js_1.Token;
      } });
      var types_js_1 = require_types2();
      Object.defineProperty(exports, "ByteSequence", { enumerable: true, get: function() {
        return types_js_1.ByteSequence;
      } });
      var util_js_1 = require_util();
      Object.defineProperty(exports, "isInnerList", { enumerable: true, get: function() {
        return util_js_1.isInnerList;
      } });
      Object.defineProperty(exports, "isByteSequence", { enumerable: true, get: function() {
        return util_js_1.isByteSequence;
      } });
      Object.defineProperty(exports, "isValidTokenStr", { enumerable: true, get: function() {
        return util_js_1.isValidTokenStr;
      } });
      Object.defineProperty(exports, "isValidKeyStr", { enumerable: true, get: function() {
        return util_js_1.isValidKeyStr;
      } });
      var token_js_2 = require_token();
      function bareItemToString(value) {
        if (typeof value === "string") {
          return value;
        }
        if (value instanceof token_js_2.Token) {
          return value.toString();
        }
        throw new TypeError(`Expected a Structured Field String or Token, got ${typeof value}`);
      }
    }
  });

  // node_modules/@hellocoop/httpsig/dist/utils/signature.js
  var require_signature = __commonJS({
    "node_modules/@hellocoop/httpsig/dist/utils/signature.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.generateSignatureBase = generateSignatureBase;
      exports.generateSignatureInputHeader = generateSignatureInputHeader;
      exports.generateSignatureParams = generateSignatureParams;
      exports.generateSignatureKeyHeader = generateSignatureKeyHeader;
      exports.generateSignatureHeader = generateSignatureHeader;
      exports.generateContentDigest = generateContentDigest;
      exports.parseSignatureInput = parseSignatureInput;
      exports.parseSignatureKey = parseSignatureKey;
      exports.generateSignatureErrorHeader = generateSignatureErrorHeader;
      exports.parseSignatureError = parseSignatureError;
      exports.generateAcceptSignatureSchemeHeader = generateAcceptSignatureSchemeHeader;
      exports.parseAcceptSignatureScheme = parseAcceptSignatureScheme;
      exports.generateAcceptSignatureAlgHeader = generateAcceptSignatureAlgHeader;
      exports.parseAcceptSignatureAlg = parseAcceptSignatureAlg;
      exports.generateAcceptSignatureHeader = generateAcceptSignatureHeader;
      exports.parseAcceptSignature = parseAcceptSignature;
      exports.parseSignature = parseSignature;
      var base64_js_1 = require_base64();
      var errors_js_1 = require_errors();
      var structured_fields_js_1 = require_structured_fields();
      function buildSignatureParams(components, created) {
        const items = components.map((component) => [
          component,
          /* @__PURE__ */ new Map()
        ]);
        return [items, /* @__PURE__ */ new Map([["created", created]])];
      }
      function parseFailure(field, error) {
        const detail = error instanceof Error ? error.message : String(error);
        return new Error(`Invalid ${field} format: ${detail}`);
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
        return (0, structured_fields_js_1.serializeDictionary)(/* @__PURE__ */ new Map([[label, buildSignatureParams(components, created)]]));
      }
      function generateSignatureParams(components, created) {
        return (0, structured_fields_js_1.serializeInnerList)(buildSignatureParams(components, created));
      }
      function generateSignatureKeyHeader(label, signatureKey, publicJwk2) {
        const oneMember = (scheme, params) => (0, structured_fields_js_1.serializeDictionary)(/* @__PURE__ */ new Map([
          [label, [new structured_fields_js_1.Token(scheme), new Map(params)]]
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
        return (0, structured_fields_js_1.serializeDictionary)(/* @__PURE__ */ new Map([
          [
            label,
            [
              new structured_fields_js_1.ByteSequence((0, base64_js_1.base64Encode)(signature)),
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
        const hash = await (0, base64_js_1.sha256)(bytes);
        const encoded = (0, base64_js_1.base64Encode)(hash);
        return `sha-256=:${encoded}:`;
      }
      function parseSignatureInput(header) {
        let dictionary;
        try {
          dictionary = (0, structured_fields_js_1.parseDictionary)(header);
        } catch (error) {
          throw parseFailure("Signature-Input", error);
        }
        const results = [];
        for (const [label, member] of dictionary) {
          if (!(0, structured_fields_js_1.isInnerList)(member)) {
            throw new Error(`Invalid Signature-Input format: member "${label}" is not an Inner List of covered components`);
          }
          const [items, parameters] = member;
          const components = [];
          for (const [bareItem, itemParameters] of items) {
            if (typeof bareItem !== "string") {
              throw new Error("Invalid Signature-Input format: a covered component identifier must be a String");
            }
            if (itemParameters.size > 0) {
              throw new Error(`Unsupported component parameters on "${bareItem}" in Signature-Input`);
            }
            components.push(bareItem);
          }
          const params = {};
          for (const [key, value] of parameters) {
            params[key] = value;
          }
          if (typeof params.created !== "number") {
            throw new Error("Signature-Input missing required parameter: created");
          }
          results.push({
            label,
            components,
            params,
            signatureParams: member
          });
        }
        return results;
      }
      function parseSignatureKey(header) {
        const malformed = new Error("Invalid Signature-Key: must be RFC 8941 Dictionary with format label=scheme;params");
        let dictionary;
        try {
          dictionary = (0, structured_fields_js_1.parseDictionary)(header);
        } catch {
          throw malformed;
        }
        if (dictionary.size !== 1) {
          throw new Error("Invalid Signature-Key: must have exactly one dictionary member");
        }
        const [label, member] = [...dictionary][0];
        if ((0, structured_fields_js_1.isInnerList)(member) || !(member[0] instanceof structured_fields_js_1.Token)) {
          throw malformed;
        }
        const scheme = member[0].toString();
        const params = {};
        for (const [key, value] of member[1]) {
          try {
            params[key] = (0, structured_fields_js_1.bareItemToString)(value);
          } catch {
            throw (0, errors_js_1.invalidKey)(`Signature-Key ${key} parameter must be a String or Token`);
          }
        }
        if (!["hwk", "jwt", "jkt-jwt", "jwks_uri"].includes(scheme)) {
          throw (0, errors_js_1.unsupportedScheme)(`Unsupported Signature-Key scheme: ${scheme}`);
        }
        if (scheme === "hwk") {
          if (!params.kty) {
            throw (0, errors_js_1.invalidKey)("Signature-Key hwk scheme missing kty parameter");
          }
          if (!params.alg) {
            throw (0, errors_js_1.invalidKey)("Signature-Key hwk scheme missing alg parameter");
          }
          if (params.kid !== void 0) {
            throw (0, errors_js_1.invalidKey)("Signature-Key hwk scheme MUST NOT include a kid parameter");
          }
          return [{ label, type: "hwk", value: params }];
        }
        if (scheme === "jwt") {
          if (!params.jwt) {
            throw new Error("Signature-Key jwt scheme missing jwt parameter");
          }
          return [
            {
              label,
              type: "jwt",
              value: { jwt: params.jwt }
            }
          ];
        }
        if (scheme === "jkt-jwt") {
          if (!params.jwt) {
            throw new Error("Signature-Key jkt-jwt scheme missing jwt parameter");
          }
          return [
            {
              label,
              type: "jkt_jwt",
              value: { jwt: params.jwt }
            }
          ];
        }
        if (scheme === "jwks_uri") {
          if (!params.id || !params.dwk || !params.kid) {
            throw new Error("Signature-Key jwks_uri scheme missing required id/dwk/kid parameters");
          }
          return [
            {
              label,
              type: "jwks_uri",
              value: {
                id: params.id,
                kid: params.kid,
                dwk: params.dwk
              }
            }
          ];
        }
        throw (0, errors_js_1.unsupportedScheme)(`Unsupported Signature-Key scheme: ${scheme}`);
      }
      function generateSignatureErrorHeader(signatureError) {
        const dictionary = /* @__PURE__ */ new Map([
          ["error", [new structured_fields_js_1.Token(signatureError.error), /* @__PURE__ */ new Map()]]
        ]);
        if (signatureError.required_input) {
          dictionary.set("required_input", [
            signatureError.required_input.map((c) => [c, /* @__PURE__ */ new Map()]),
            /* @__PURE__ */ new Map()
          ]);
        }
        return (0, structured_fields_js_1.serializeDictionary)(dictionary);
      }
      function parseSignatureError(header) {
        let dictionary;
        try {
          dictionary = (0, structured_fields_js_1.parseDictionary)(header);
        } catch (error2) {
          throw parseFailure("Signature-Error", error2);
        }
        const errorMember = dictionary.get("error");
        if (errorMember === void 0 || (0, structured_fields_js_1.isInnerList)(errorMember)) {
          throw new Error("Invalid Signature-Error: missing error member");
        }
        const error = (0, structured_fields_js_1.bareItemToString)(errorMember[0]);
        const validCodes = [
          "unsupported_algorithm",
          "unsupported_scheme",
          "invalid_signature",
          "invalid_input",
          "invalid_request",
          "invalid_key",
          "unknown_key",
          "invalid_jwt",
          "expired_jwt",
          "issuer_missing",
          "issuer_mismatch"
        ];
        if (!validCodes.includes(error)) {
          throw new Error(`Invalid Signature-Error code: ${error}`);
        }
        const result = { error };
        const inputMember = dictionary.get("required_input");
        if (inputMember !== void 0) {
          if (!(0, structured_fields_js_1.isInnerList)(inputMember)) {
            throw new Error("Invalid Signature-Error: required_input must be an Inner List");
          }
          result.required_input = inputMember[0].map(([component]) => (0, structured_fields_js_1.bareItemToString)(component));
        }
        return result;
      }
      function generateTokenList(values) {
        for (const value of values) {
          if (!(0, structured_fields_js_1.isValidTokenStr)(value)) {
            throw new Error(`Value is not a valid Structured Field Token: ${value}`);
          }
        }
        return (0, structured_fields_js_1.serializeList)(values.map((value) => [new structured_fields_js_1.Token(value), /* @__PURE__ */ new Map()]));
      }
      function parseTokenList(header) {
        return (0, structured_fields_js_1.parseList)(header).filter((member) => !(0, structured_fields_js_1.isInnerList)(member)).map(([bareItem]) => bareItem).filter((bareItem) => bareItem instanceof structured_fields_js_1.Token).map((token) => token.toString());
      }
      function generateAcceptSignatureSchemeHeader(schemes) {
        return generateTokenList(schemes);
      }
      function parseAcceptSignatureScheme(header) {
        return parseTokenList(header);
      }
      function generateAcceptSignatureAlgHeader(algs) {
        return generateTokenList(algs);
      }
      function parseAcceptSignatureAlg(header) {
        return parseTokenList(header);
      }
      function generateAcceptSignatureHeader(params) {
        const { label = "sig", components, alg, tag } = params;
        const parameters = /* @__PURE__ */ new Map();
        if (alg) {
          parameters.set("alg", alg);
        }
        if (tag) {
          parameters.set("tag", tag);
        }
        const innerList = [
          components.map((c) => [c, /* @__PURE__ */ new Map()]),
          parameters
        ];
        return (0, structured_fields_js_1.serializeDictionary)(/* @__PURE__ */ new Map([[label, innerList]]));
      }
      function parseAcceptSignature(header) {
        const malformed = new Error("Invalid Accept-Signature format");
        let dictionary;
        try {
          dictionary = (0, structured_fields_js_1.parseDictionary)(header);
        } catch {
          throw malformed;
        }
        if (dictionary.size !== 1) {
          throw malformed;
        }
        const [label, member] = [...dictionary][0];
        if (!(0, structured_fields_js_1.isInnerList)(member)) {
          throw malformed;
        }
        const result = {
          label,
          components: member[0].map(([component]) => (0, structured_fields_js_1.bareItemToString)(component))
        };
        const alg = member[1].get("alg");
        if (alg !== void 0) {
          result.alg = (0, structured_fields_js_1.bareItemToString)(alg);
        }
        const tag = member[1].get("tag");
        if (tag !== void 0) {
          result.tag = (0, structured_fields_js_1.bareItemToString)(tag);
        }
        return result;
      }
      function parseSignature(header) {
        let dictionary;
        try {
          dictionary = (0, structured_fields_js_1.parseDictionary)(header);
        } catch (error) {
          throw parseFailure("Signature", error);
        }
        const results = /* @__PURE__ */ new Map();
        for (const [label, member] of dictionary) {
          if ((0, structured_fields_js_1.isInnerList)(member) || !(0, structured_fields_js_1.isByteSequence)(member[0])) {
            throw new Error(`Invalid Signature format: member "${label}" is not a Byte Sequence`);
          }
          results.set(label, (0, base64_js_1.base64Decode)(member[0].toBase64()));
        }
        return results;
      }
    }
  });

  // node_modules/@hellocoop/httpsig/dist/fetch.js
  var require_fetch = __commonJS({
    "node_modules/@hellocoop/httpsig/dist/fetch.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.fetch = fetch2;
      var types_js_1 = require_types();
      var crypto_js_1 = require_crypto();
      var signature_js_1 = require_signature();
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
            if (!types_js_1.VALID_DERIVED_COMPONENTS.includes(component)) {
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
        (0, crypto_js_1.validateJwk)(signingKey);
        let privateKey;
        let algorithm;
        if (signingKey.d) {
          privateKey = await (0, crypto_js_1.importPrivateKey)(signingKey);
          algorithm = (0, crypto_js_1.getAlgorithmFromJwk)(signingKey);
        } else {
          if (!signingCryptoKey) {
            throw new Error("signingCryptoKey is required when signingKey does not contain private key material");
          }
          privateKey = signingCryptoKey;
          algorithm = (0, crypto_js_1.getAlgorithmFromJwk)(signingKey);
        }
        const publicJwk2 = (0, crypto_js_1.getPublicJwk)(signingKey);
        const urlObj = typeof url === "string" ? new URL(url) : url;
        const targetUri = urlObj.href;
        const headers = new Headers(inputHeaders);
        let components;
        if (customComponents) {
          components = [...new Set(customComponents)];
        } else {
          const hasBody = body !== void 0 && body !== null;
          components = hasBody ? [...types_js_1.DEFAULT_COMPONENTS_BODY] : [...types_js_1.DEFAULT_COMPONENTS_GET];
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
            const contentDigest2 = await (0, signature_js_1.generateContentDigest)(body);
            headers.set("content-digest", contentDigest2);
          }
        }
        if (components.includes("signature-key")) {
          const signatureKeyHeader = (0, signature_js_1.generateSignatureKeyHeader)(label, signatureKey, publicJwk2);
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
        const signatureInputHeader = (0, signature_js_1.generateSignatureInputHeader)(label, components, created);
        headers.set("signature-input", signatureInputHeader);
        componentValues.set("@signature-params", (0, signature_js_1.generateSignatureParams)(components, created));
        components.push("@signature-params");
        const signatureBase = (0, signature_js_1.generateSignatureBase)(components, componentValues);
        const signatureBaseBytes = new TextEncoder().encode(signatureBase);
        const signature = await (0, crypto_js_1.sign)(signatureBaseBytes, privateKey, algorithm);
        const signatureHeader = (0, signature_js_1.generateSignatureHeader)(label, signature);
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
    }
  });

  // node_modules/@hellocoop/httpsig/dist/utils/thumbprint.js
  var require_thumbprint = __commonJS({
    "node_modules/@hellocoop/httpsig/dist/utils/thumbprint.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.calculateThumbprint = calculateThumbprint;
      var base64_js_1 = require_base64();
      async function calculateThumbprint(jwk, hashAlgorithm = "SHA-256") {
        let canonical;
        switch (jwk.kty) {
          case "OKP": {
            if (!jwk.crv || !jwk.x) {
              throw new Error("OKP key missing required fields (crv, x)");
            }
            canonical = JSON.stringify({
              crv: jwk.crv,
              kty: jwk.kty,
              x: jwk.x
            });
            break;
          }
          case "EC": {
            if (!jwk.crv || !jwk.x || !jwk.y) {
              throw new Error("EC key missing required fields (crv, x, y)");
            }
            canonical = JSON.stringify({
              crv: jwk.crv,
              kty: jwk.kty,
              x: jwk.x,
              y: jwk.y
            });
            break;
          }
          case "RSA": {
            if (!jwk.e || !jwk.n) {
              throw new Error("RSA key missing required fields (e, n)");
            }
            canonical = JSON.stringify({
              e: jwk.e,
              kty: jwk.kty,
              n: jwk.n
            });
            break;
          }
          default:
            throw new Error(`Unsupported key type: ${jwk.kty}`);
        }
        const hashFn = hashAlgorithm === "SHA-512" ? base64_js_1.sha512 : base64_js_1.sha256;
        const hash = await hashFn(canonical);
        return (0, base64_js_1.base64urlEncode)(hash);
      }
    }
  });

  // node_modules/@hellocoop/httpsig/dist/utils/cache.js
  var require_cache = __commonJS({
    "node_modules/@hellocoop/httpsig/dist/utils/cache.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.BoundedTtlCache = exports.DEFAULT_MAX_ENTRIES = void 0;
      exports.DEFAULT_MAX_ENTRIES = 100;
      var BoundedTtlCache = class {
        entries = /* @__PURE__ */ new Map();
        maxEntries;
        constructor(maxEntries = exports.DEFAULT_MAX_ENTRIES) {
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
      exports.BoundedTtlCache = BoundedTtlCache;
    }
  });

  // node_modules/@hellocoop/httpsig/dist/verify.js
  var require_verify = __commonJS({
    "node_modules/@hellocoop/httpsig/dist/verify.js"(exports) {
      "use strict";
      var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
        if (k2 === void 0) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = { enumerable: true, get: function() {
            return m[k];
          } };
        }
        Object.defineProperty(o, k2, desc);
      }) : (function(o, m, k, k2) {
        if (k2 === void 0) k2 = k;
        o[k2] = m[k];
      }));
      var __setModuleDefault = exports && exports.__setModuleDefault || (Object.create ? (function(o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }) : function(o, v) {
        o["default"] = v;
      });
      var __importStar = exports && exports.__importStar || /* @__PURE__ */ (function() {
        var ownKeys = function(o) {
          ownKeys = Object.getOwnPropertyNames || function(o2) {
            var ar = [];
            for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
            return ar;
          };
          return ownKeys(o);
        };
        return function(mod) {
          if (mod && mod.__esModule) return mod;
          var result = {};
          if (mod != null) {
            for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
          }
          __setModuleDefault(result, mod);
          return result;
        };
      })();
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.verify = verify;
      var crypto_js_1 = require_crypto();
      var signature_js_1 = require_signature();
      var structured_fields_js_1 = require_structured_fields();
      var base64_js_1 = require_base64();
      var thumbprint_js_1 = require_thumbprint();
      var cache_js_1 = require_cache();
      var errors_js_1 = require_errors();
      var jwksCache = new cache_js_1.BoundedTtlCache();
      function toSignatureError(error) {
        if (error instanceof errors_js_1.SignatureVerificationError) {
          const result = { error: error.code };
          if (error.requiredInput) {
            result.required_input = error.requiredInput;
          }
          return result;
        }
        return mapToSignatureError(error instanceof Error ? error.message : String(error));
      }
      function mapToSignatureError(errorMessage) {
        if (errorMessage.includes("Missing Signature-Key") || errorMessage.includes("Missing Signature-Input") || errorMessage.includes("Missing Signature") || errorMessage.includes("No signature found") || errorMessage.includes("No Signature-Input found") || errorMessage.includes("does not verify") || errorMessage.includes("Signature timestamp out of")) {
          return { error: "invalid_signature" };
        }
        if (errorMessage.includes("AAuth profile violation")) {
          return {
            error: "invalid_input",
            required_input: ["@method", "@authority", "@path", "signature-key"]
          };
        }
        if (errorMessage.includes("content-digest")) {
          return { error: "invalid_input" };
        }
        if (errorMessage.includes("Missing header for component")) {
          return { error: "invalid_input" };
        }
        if (errorMessage.includes("Unsupported signature key type") || errorMessage.includes("Unsupported Signature-Key scheme")) {
          return { error: "invalid_key" };
        }
        if (errorMessage.includes("Signature-Key") && errorMessage.includes("missing")) {
          return { error: "invalid_key" };
        }
        if (errorMessage.includes("Invalid JWK") || errorMessage.includes("validate") || errorMessage.includes("kty parameter")) {
          return { error: "invalid_key" };
        }
        if (errorMessage.includes("not found in JWKS") || errorMessage.includes("unknown_key")) {
          return { error: "unknown_key" };
        }
        if (errorMessage.includes("jkt-jwt: JWT expired")) {
          return { error: "expired_jwt" };
        }
        if (errorMessage.includes("jkt-jwt:") || errorMessage.includes("Invalid JWT") || errorMessage.includes("JWT missing")) {
          return { error: "invalid_jwt" };
        }
        return { error: "invalid_signature" };
      }
      function normalizeHeaders(headers) {
        const result = /* @__PURE__ */ new Map();
        if (headers instanceof Headers) {
          headers.forEach((value, key) => {
            result.set(key.toLowerCase(), value);
          });
        } else {
          for (const [key, value] of Object.entries(headers)) {
            const normalized = Array.isArray(value) ? value.join(", ") : value;
            result.set(key.toLowerCase(), normalized);
          }
        }
        return result;
      }
      async function fetchJWKS(url, cacheTtl) {
        const cached = jwksCache.get(url);
        if (cached !== void 0) {
          return cached;
        }
        const response = await globalThis.fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch JWKS from ${url}: ${response.statusText}`);
        }
        const jwks = await response.json();
        jwksCache.set(url, jwks, cacheTtl);
        return jwks;
      }
      async function getPublicKeyFromJWKS(id, kid, dwk, cacheTtl) {
        const metadataUrl = `${id}/.well-known/${dwk}`;
        const metadata = await fetchJWKS(metadataUrl, cacheTtl);
        if (metadata.issuer === void 0) {
          throw (0, errors_js_1.issuerMissing)(`Metadata document missing issuer: ${metadataUrl}`);
        }
        if (metadata.issuer !== id) {
          throw (0, errors_js_1.issuerMismatch)(`Metadata issuer "${metadata.issuer}" does not match id "${id}"`);
        }
        if (!metadata.jwks_uri) {
          throw new Error(`Metadata document missing jwks_uri: ${metadataUrl}`);
        }
        const jwksUrl = metadata.jwks_uri;
        const jwks = await fetchJWKS(jwksUrl, cacheTtl);
        if (!jwks.keys || !Array.isArray(jwks.keys)) {
          throw new Error(`Invalid JWKS format from ${jwksUrl}`);
        }
        const key = jwks.keys.find((k) => k.kid === kid);
        if (!key) {
          throw new Error(`Key with kid="${kid}" not found in JWKS from ${jwksUrl}`);
        }
        return key;
      }
      function decodeJWT(jwt, maxClockSkew) {
        const parts = jwt.split(".");
        if (parts.length !== 3) {
          throw (0, errors_js_1.invalidJwt)("Invalid JWT format");
        }
        let header;
        let payload;
        try {
          header = JSON.parse(new TextDecoder().decode((0, base64_js_1.base64urlDecode)(parts[0])));
          payload = JSON.parse(new TextDecoder().decode((0, base64_js_1.base64urlDecode)(parts[1])));
        } catch {
          throw (0, errors_js_1.invalidJwt)("Invalid JWT: header or payload is not valid JSON");
        }
        if (!payload.cnf || !payload.cnf.jwk) {
          throw (0, errors_js_1.invalidJwt)("JWT missing cnf.jwk claim");
        }
        const now = Math.floor(Date.now() / 1e3);
        if (typeof payload.exp !== "number") {
          throw (0, errors_js_1.invalidJwt)("JWT missing required exp claim");
        }
        if (payload.exp + maxClockSkew < now) {
          throw (0, errors_js_1.expiredJwt)("JWT expired");
        }
        if (payload.iat !== void 0) {
          if (typeof payload.iat !== "number") {
            throw (0, errors_js_1.invalidJwt)("JWT iat claim is not a number");
          }
          if (payload.iat - maxClockSkew > now) {
            throw (0, errors_js_1.invalidJwt)("JWT iat is in the future");
          }
        }
        return {
          header,
          payload,
          publicKey: payload.cnf.jwk
        };
      }
      var JKT_JWT_TYPES = {
        "jkt-s256+jwt": {
          hashAlgorithm: "SHA-256",
          issPrefix: "urn:jkt:sha-256:"
        },
        "jkt-s512+jwt": {
          hashAlgorithm: "SHA-512",
          issPrefix: "urn:jkt:sha-512:"
        }
      };
      async function verifyJktJwt(jwtString, maxClockSkew) {
        const parts = jwtString.split(".");
        if (parts.length !== 3) {
          throw new Error("Invalid JWT format");
        }
        const header = JSON.parse(new TextDecoder().decode((0, base64_js_1.base64urlDecode)(parts[0])));
        const payload = JSON.parse(new TextDecoder().decode((0, base64_js_1.base64urlDecode)(parts[1])));
        const typConfig = JKT_JWT_TYPES[header.typ];
        if (!typConfig) {
          throw new Error(`Unsupported jkt-jwt typ: ${header.typ}. Supported: ${Object.keys(JKT_JWT_TYPES).join(", ")}`);
        }
        const identityJwk = header.jwk;
        if (!identityJwk) {
          throw new Error("jkt-jwt: JWT header missing jwk claim");
        }
        const thumbprint = await (0, thumbprint_js_1.calculateThumbprint)(identityJwk, typConfig.hashAlgorithm);
        const expectedIss = `${typConfig.issPrefix}${thumbprint}`;
        if (payload.iss !== expectedIss) {
          throw new Error(`jkt-jwt: iss mismatch. Expected ${expectedIss}, got ${payload.iss}`);
        }
        (0, crypto_js_1.validateJwk)(identityJwk);
        const identityPublicKey = await (0, crypto_js_1.importPublicKey)(identityJwk);
        const algorithm = (0, crypto_js_1.getAlgorithmFromJwk)(identityJwk);
        const signedData = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
        const signature = (0, base64_js_1.base64urlDecode)(parts[2]);
        const jwtValid = await (0, crypto_js_1.verify)(signedData, signature, identityPublicKey, algorithm);
        if (!jwtValid) {
          throw new Error("jkt-jwt: JWT signature verification failed");
        }
        const now = Math.floor(Date.now() / 1e3);
        if (!payload.exp || typeof payload.exp !== "number") {
          throw new Error("jkt-jwt: JWT missing exp claim");
        }
        if (payload.exp + maxClockSkew < now) {
          throw new Error("jkt-jwt: JWT expired");
        }
        if (!payload.iat || typeof payload.iat !== "number") {
          throw new Error("jkt-jwt: JWT missing iat claim");
        }
        if (payload.iat - maxClockSkew > now) {
          throw new Error("jkt-jwt: JWT iat is in the future");
        }
        if (!payload.cnf || !payload.cnf.jwk) {
          throw new Error("jkt-jwt: JWT missing cnf.jwk claim");
        }
        return {
          header,
          payload,
          ephemeralKey: payload.cnf.jwk,
          identityKey: identityJwk,
          identityThumbprint: expectedIss
        };
      }
      async function verify(request, options = {}) {
        const {
          maxClockSkew = 60,
          jwksCacheTtl = 36e5,
          // 1 hour
          supportedAlgorithms,
          requireContentDigest = false
        } = options;
        const accepted = supportedAlgorithms ?? crypto_js_1.SUPPORTED_ALGORITHMS;
        try {
          const headers = normalizeHeaders(request.headers);
          const signatureKeyHeader = headers.get("signature-key");
          if (!signatureKeyHeader) {
            throw new Error("Missing Signature-Key header");
          }
          const signatureKeys = (0, signature_js_1.parseSignatureKey)(signatureKeyHeader);
          const signatureKey = signatureKeys[0];
          const label = signatureKey.label;
          const signatureInputHeader = headers.get("signature-input");
          if (!signatureInputHeader) {
            throw new Error("Missing Signature-Input header");
          }
          const signatureInputs = (0, signature_js_1.parseSignatureInput)(signatureInputHeader);
          const signatureInput = signatureInputs.find((si) => si.label === label);
          if (!signatureInput) {
            throw new Error(`No Signature-Input found for label "${label}" from Signature-Key`);
          }
          const { components, params } = signatureInput;
          if (!components.includes("signature-key")) {
            throw (0, errors_js_1.invalidInput)("signature-key must be a covered component", [
              "@method",
              "@authority",
              "@path",
              "signature-key"
            ]);
          }
          const now = Math.floor(Date.now() / 1e3);
          const skew = Math.abs(now - params.created);
          if (skew > maxClockSkew) {
            throw new Error(`Signature timestamp out of acceptable range (skew: ${skew}s)`);
          }
          let publicJwk2;
          let jwtData;
          let jktJwtData;
          let jwksUriData;
          if (signatureKey.type === "hwk") {
            publicJwk2 = signatureKey.value;
          } else if (signatureKey.type === "jwt") {
            const jwtValue = signatureKey.value;
            const { header, payload, publicKey: publicKey2 } = decodeJWT(jwtValue.jwt, maxClockSkew);
            publicJwk2 = publicKey2;
            jwtData = {
              header,
              payload,
              raw: jwtValue.jwt
            };
          } else if (signatureKey.type === "jkt_jwt") {
            const jwtValue = signatureKey.value;
            const { header, payload, ephemeralKey, identityKey, identityThumbprint } = await verifyJktJwt(jwtValue.jwt, maxClockSkew);
            publicJwk2 = ephemeralKey;
            jktJwtData = {
              header,
              payload,
              raw: jwtValue.jwt,
              identityKey,
              identityThumbprint
            };
          } else if (signatureKey.type === "jwks_uri") {
            const jwksUriValue = signatureKey.value;
            const { id, kid, dwk } = jwksUriValue;
            publicJwk2 = await getPublicKeyFromJWKS(id, kid, dwk, jwksCacheTtl);
            jwksUriData = { id, kid, dwk };
          } else {
            throw new Error(`Unsupported signature key type: ${signatureKey.type}`);
          }
          (0, crypto_js_1.validateJwk)(publicJwk2);
          if (!accepted.includes(publicJwk2.alg)) {
            throw (0, errors_js_1.unsupportedAlgorithm)(`Algorithm "${publicJwk2.alg}" is not accepted by this verifier`, [...accepted]);
          }
          const signatureHeader = headers.get("signature");
          if (!signatureHeader) {
            throw new Error("Missing Signature header");
          }
          const signatures = (0, signature_js_1.parseSignature)(signatureHeader);
          const signature = signatures.get(label);
          if (!signature) {
            throw new Error(`No signature found for label: ${label}`);
          }
          const queryString = request.query ? `?${request.query}` : "";
          const targetUri = `https://${request.authority}${request.path}${queryString}`;
          const componentValues = /* @__PURE__ */ new Map();
          componentValues.set("@method", request.method.toUpperCase());
          componentValues.set("@target-uri", targetUri);
          componentValues.set("@authority", request.authority);
          componentValues.set("@scheme", "https");
          componentValues.set("@request-target", `${request.path}${queryString}`);
          componentValues.set("@path", request.path);
          componentValues.set("@query", request.query || "");
          if (requireContentDigest && request.body !== void 0 && !components.includes("content-digest")) {
            throw (0, errors_js_1.invalidInput)("content-digest must be a covered component on a request with a body", [
              "@method",
              "@authority",
              "@path",
              "content-digest",
              "content-type",
              "signature-key"
            ]);
          }
          if (request.body !== void 0 && components.includes("content-digest")) {
            const expectedDigest = headers.get("content-digest");
            if (!expectedDigest) {
              throw new Error("content-digest component specified but header missing");
            }
            const { generateContentDigest } = await Promise.resolve().then(() => __importStar(require_signature()));
            const actualDigest = await generateContentDigest(request.body);
            if (actualDigest !== expectedDigest) {
              throw new Error("content-digest does not match body");
            }
          }
          for (const component of components) {
            if (component.startsWith("@")) {
              continue;
            }
            const value = headers.get(component);
            if (value === void 0) {
              throw new Error(`Missing header for component: ${component}`);
            }
            componentValues.set(component, value);
          }
          const signatureParams = (0, structured_fields_js_1.serializeInnerList)(signatureInput.signatureParams);
          componentValues.set("@signature-params", signatureParams);
          const componentsWithParams = [...components, "@signature-params"];
          const signatureBase = (0, signature_js_1.generateSignatureBase)(componentsWithParams, componentValues);
          const signatureBaseBytes = new TextEncoder().encode(signatureBase);
          const thumbprint = await (0, thumbprint_js_1.calculateThumbprint)(publicJwk2);
          const publicKey = await (0, crypto_js_1.importPublicKey)(publicJwk2);
          const algorithm = (0, crypto_js_1.getAlgorithmFromJwk)(publicJwk2);
          const isValid = await (0, crypto_js_1.verify)(signatureBaseBytes, signature, publicKey, algorithm);
          const result = {
            verified: isValid,
            label,
            keyType: signatureKey.type,
            publicKey: publicJwk2,
            thumbprint,
            created: params.created
          };
          if (jwtData) {
            result.jwt = jwtData;
          }
          if (jktJwtData) {
            result.jkt_jwt = jktJwtData;
          }
          if (jwksUriData) {
            result.jwks_uri = jwksUriData;
          }
          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            verified: false,
            label: "",
            keyType: "hwk",
            publicKey: {},
            thumbprint: "",
            created: 0,
            error: errorMessage,
            signatureError: toSignatureError(error),
            ...error instanceof errors_js_1.SignatureVerificationError && error.supportedAlgorithms ? { acceptSignatureAlg: error.supportedAlgorithms } : {}
          };
        }
      }
    }
  });

  // node_modules/@hellocoop/httpsig/dist/helpers.js
  var require_helpers = __commonJS({
    "node_modules/@hellocoop/httpsig/dist/helpers.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.expressVerify = expressVerify;
      exports.fastifyVerify = fastifyVerify;
      exports.nextJsVerify = nextJsVerify;
      exports.nextJsPagesVerify = nextJsPagesVerify;
      var verify_js_1 = require_verify();
      async function expressVerify(req, authority, options) {
        const urlObj = new URL(req.originalUrl, `${req.protocol}://${req.hostname}`);
        return (0, verify_js_1.verify)({
          method: req.method,
          authority,
          path: urlObj.pathname,
          query: urlObj.search ? urlObj.search.substring(1) : void 0,
          headers: req.headers,
          body: req.body
        }, options);
      }
      async function fastifyVerify(request, authority, options) {
        const urlObj = new URL(request.url, `${request.protocol}://${request.hostname}`);
        return (0, verify_js_1.verify)({
          method: request.method,
          authority,
          path: urlObj.pathname,
          query: urlObj.search ? urlObj.search.substring(1) : void 0,
          headers: request.headers,
          body: request.rawBody
        }, options);
      }
      async function nextJsVerify(request, authority, body, options) {
        const urlObj = new URL(request.url);
        return (0, verify_js_1.verify)({
          method: request.method,
          authority,
          path: urlObj.pathname,
          query: urlObj.search ? urlObj.search.substring(1) : void 0,
          headers: request.headers,
          body
        }, options);
      }
      async function nextJsPagesVerify(req, authority, body, options) {
        const reqUrl = req.url || "/";
        const urlObj = new URL(reqUrl, `https://${authority}`);
        return (0, verify_js_1.verify)({
          method: req.method || "GET",
          authority,
          path: urlObj.pathname,
          query: urlObj.search ? urlObj.search.substring(1) : void 0,
          headers: req.headers,
          body
        }, options);
      }
    }
  });

  // node_modules/@hellocoop/httpsig/dist/index.js
  var require_dist = __commonJS({
    "node_modules/@hellocoop/httpsig/dist/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.DEFAULT_COMPONENTS_BODY = exports.DEFAULT_COMPONENTS_GET = exports.VALID_DERIVED_COMPONENTS = exports.calculateThumbprint = exports.SignatureVerificationError = exports.SUPPORTED_ALGORITHMS = exports.determineAlgorithm = exports.generateKeyPair = exports.SerializeError = exports.ParseError = exports.ByteSequence = exports.Token = exports.isValidKeyStr = exports.isValidTokenStr = exports.isByteSequence = exports.isInnerList = exports.bareItemToString = exports.serializeParameters = exports.serializeBareItem = exports.serializeInnerList = exports.serializeItem = exports.serializeList = exports.serializeDictionary = exports.parseItem = exports.parseList = exports.parseDictionary = exports.parseAcceptSignatureAlg = exports.generateAcceptSignatureAlgHeader = exports.parseAcceptSignatureScheme = exports.generateAcceptSignatureSchemeHeader = exports.parseAcceptSignature = exports.generateAcceptSignatureHeader = exports.parseSignatureError = exports.generateSignatureErrorHeader = exports.nextJsPagesVerify = exports.nextJsVerify = exports.fastifyVerify = exports.expressVerify = exports.verify = void 0;
      var fetch_js_1 = require_fetch();
      Object.defineProperty(exports, "fetch", { enumerable: true, get: function() {
        return fetch_js_1.fetch;
      } });
      var verify_js_1 = require_verify();
      Object.defineProperty(exports, "verify", { enumerable: true, get: function() {
        return verify_js_1.verify;
      } });
      var helpers_js_1 = require_helpers();
      Object.defineProperty(exports, "expressVerify", { enumerable: true, get: function() {
        return helpers_js_1.expressVerify;
      } });
      Object.defineProperty(exports, "fastifyVerify", { enumerable: true, get: function() {
        return helpers_js_1.fastifyVerify;
      } });
      Object.defineProperty(exports, "nextJsVerify", { enumerable: true, get: function() {
        return helpers_js_1.nextJsVerify;
      } });
      Object.defineProperty(exports, "nextJsPagesVerify", { enumerable: true, get: function() {
        return helpers_js_1.nextJsPagesVerify;
      } });
      var signature_js_1 = require_signature();
      Object.defineProperty(exports, "generateSignatureErrorHeader", { enumerable: true, get: function() {
        return signature_js_1.generateSignatureErrorHeader;
      } });
      Object.defineProperty(exports, "parseSignatureError", { enumerable: true, get: function() {
        return signature_js_1.parseSignatureError;
      } });
      Object.defineProperty(exports, "generateAcceptSignatureHeader", { enumerable: true, get: function() {
        return signature_js_1.generateAcceptSignatureHeader;
      } });
      Object.defineProperty(exports, "parseAcceptSignature", { enumerable: true, get: function() {
        return signature_js_1.parseAcceptSignature;
      } });
      Object.defineProperty(exports, "generateAcceptSignatureSchemeHeader", { enumerable: true, get: function() {
        return signature_js_1.generateAcceptSignatureSchemeHeader;
      } });
      Object.defineProperty(exports, "parseAcceptSignatureScheme", { enumerable: true, get: function() {
        return signature_js_1.parseAcceptSignatureScheme;
      } });
      Object.defineProperty(exports, "generateAcceptSignatureAlgHeader", { enumerable: true, get: function() {
        return signature_js_1.generateAcceptSignatureAlgHeader;
      } });
      Object.defineProperty(exports, "parseAcceptSignatureAlg", { enumerable: true, get: function() {
        return signature_js_1.parseAcceptSignatureAlg;
      } });
      var structured_fields_js_1 = require_structured_fields();
      Object.defineProperty(exports, "parseDictionary", { enumerable: true, get: function() {
        return structured_fields_js_1.parseDictionary;
      } });
      Object.defineProperty(exports, "parseList", { enumerable: true, get: function() {
        return structured_fields_js_1.parseList;
      } });
      Object.defineProperty(exports, "parseItem", { enumerable: true, get: function() {
        return structured_fields_js_1.parseItem;
      } });
      Object.defineProperty(exports, "serializeDictionary", { enumerable: true, get: function() {
        return structured_fields_js_1.serializeDictionary;
      } });
      Object.defineProperty(exports, "serializeList", { enumerable: true, get: function() {
        return structured_fields_js_1.serializeList;
      } });
      Object.defineProperty(exports, "serializeItem", { enumerable: true, get: function() {
        return structured_fields_js_1.serializeItem;
      } });
      Object.defineProperty(exports, "serializeInnerList", { enumerable: true, get: function() {
        return structured_fields_js_1.serializeInnerList;
      } });
      Object.defineProperty(exports, "serializeBareItem", { enumerable: true, get: function() {
        return structured_fields_js_1.serializeBareItem;
      } });
      Object.defineProperty(exports, "serializeParameters", { enumerable: true, get: function() {
        return structured_fields_js_1.serializeParameters;
      } });
      Object.defineProperty(exports, "bareItemToString", { enumerable: true, get: function() {
        return structured_fields_js_1.bareItemToString;
      } });
      Object.defineProperty(exports, "isInnerList", { enumerable: true, get: function() {
        return structured_fields_js_1.isInnerList;
      } });
      Object.defineProperty(exports, "isByteSequence", { enumerable: true, get: function() {
        return structured_fields_js_1.isByteSequence;
      } });
      Object.defineProperty(exports, "isValidTokenStr", { enumerable: true, get: function() {
        return structured_fields_js_1.isValidTokenStr;
      } });
      Object.defineProperty(exports, "isValidKeyStr", { enumerable: true, get: function() {
        return structured_fields_js_1.isValidKeyStr;
      } });
      Object.defineProperty(exports, "Token", { enumerable: true, get: function() {
        return structured_fields_js_1.Token;
      } });
      Object.defineProperty(exports, "ByteSequence", { enumerable: true, get: function() {
        return structured_fields_js_1.ByteSequence;
      } });
      Object.defineProperty(exports, "ParseError", { enumerable: true, get: function() {
        return structured_fields_js_1.ParseError;
      } });
      Object.defineProperty(exports, "SerializeError", { enumerable: true, get: function() {
        return structured_fields_js_1.SerializeError;
      } });
      var crypto_js_1 = require_crypto();
      Object.defineProperty(exports, "generateKeyPair", { enumerable: true, get: function() {
        return crypto_js_1.generateKeyPair;
      } });
      Object.defineProperty(exports, "determineAlgorithm", { enumerable: true, get: function() {
        return crypto_js_1.determineAlgorithm;
      } });
      Object.defineProperty(exports, "SUPPORTED_ALGORITHMS", { enumerable: true, get: function() {
        return crypto_js_1.SUPPORTED_ALGORITHMS;
      } });
      var errors_js_1 = require_errors();
      Object.defineProperty(exports, "SignatureVerificationError", { enumerable: true, get: function() {
        return errors_js_1.SignatureVerificationError;
      } });
      var thumbprint_js_1 = require_thumbprint();
      Object.defineProperty(exports, "calculateThumbprint", { enumerable: true, get: function() {
        return thumbprint_js_1.calculateThumbprint;
      } });
      var types_js_1 = require_types();
      Object.defineProperty(exports, "VALID_DERIVED_COMPONENTS", { enumerable: true, get: function() {
        return types_js_1.VALID_DERIVED_COMPONENTS;
      } });
      Object.defineProperty(exports, "DEFAULT_COMPONENTS_GET", { enumerable: true, get: function() {
        return types_js_1.DEFAULT_COMPONENTS_GET;
      } });
      Object.defineProperty(exports, "DEFAULT_COMPONENTS_BODY", { enumerable: true, get: function() {
        return types_js_1.DEFAULT_COMPONENTS_BODY;
      } });
    }
  });

  // client/registry.js
  var import_httpsig = __toESM(require_dist());
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
    return (0, import_httpsig.fetch)(url, {
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
    const response = await (0, import_httpsig.fetch)(`${ORIGIN}/bootstrap`, {
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
