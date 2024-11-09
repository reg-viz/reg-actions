"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/.pnpm/@tybys+wasm-util@0.9.0/node_modules/@tybys/wasm-util/dist/wasm-util.esm-bundler.js
var wasm_util_esm_bundler_exports = {};
__export(wasm_util_esm_bundler_exports, {
  Asyncify: () => Asyncify,
  Memory: () => Memory,
  WASI: () => WASI,
  WebAssemblyMemory: () => WebAssemblyMemory,
  asyncifyLoad: () => asyncifyLoad,
  asyncifyLoadSync: () => asyncifyLoadSync,
  createAsyncWASI: () => createAsyncWASI,
  extendMemory: () => extendMemory,
  load: () => load,
  loadSync: () => loadSync,
  wrapAsyncExport: () => wrapAsyncExport,
  wrapAsyncImport: () => wrapAsyncImport,
  wrapExports: () => wrapExports
});
function validateObject(value, name) {
  if (value === null || typeof value !== "object") {
    throw new TypeError(`${name} must be an object. Received ${value === null ? "null" : typeof value}`);
  }
}
function validateArray(value, name) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${name} must be an array. Received ${value === null ? "null" : typeof value}`);
  }
}
function validateBoolean(value, name) {
  if (typeof value !== "boolean") {
    throw new TypeError(`${name} must be a boolean. Received ${value === null ? "null" : typeof value}`);
  }
}
function validateString(value, name) {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string. Received ${value === null ? "null" : typeof value}`);
  }
}
function validateFunction(value, name) {
  if (typeof value !== "function") {
    throw new TypeError(`${name} must be a function. Received ${value === null ? "null" : typeof value}`);
  }
}
function validateUndefined(value, name) {
  if (value !== void 0) {
    throw new TypeError(`${name} must be undefined. Received ${value === null ? "null" : typeof value}`);
  }
}
function isPromiseLike(obj) {
  return !!(obj && (typeof obj === "object" || typeof obj === "function") && typeof obj.then === "function");
}
function wrapInstanceExports(exports2, mapFn) {
  const newExports = /* @__PURE__ */ Object.create(null);
  Object.keys(exports2).forEach((name) => {
    const exportValue = exports2[name];
    Object.defineProperty(newExports, name, {
      enumerable: true,
      value: mapFn(exportValue, name)
    });
  });
  return newExports;
}
function sleepBreakIf(delay, breakIf) {
  const start = Date.now();
  const end = start + delay;
  let ret = false;
  while (Date.now() < end) {
    if (breakIf()) {
      ret = true;
      break;
    }
  }
  return ret;
}
function unsharedSlice(view, start, end) {
  return typeof SharedArrayBuffer === "function" && view.buffer instanceof SharedArrayBuffer || Object.prototype.toString.call(view.buffer.constructor) === "[object SharedArrayBuffer]" ? view.slice(start, end) : view.subarray(start, end);
}
function tryAllocate(instance, wasm64, size, mallocName) {
  if (typeof instance.exports[mallocName] !== "function" || size <= 0) {
    return {
      wasm64,
      dataPtr: 16,
      start: wasm64 ? 32 : 24,
      end: 1024
    };
  }
  const malloc = instance.exports[mallocName];
  const dataPtr = wasm64 ? Number(malloc(BigInt(16) + BigInt(size))) : malloc(8 + size);
  if (dataPtr === 0) {
    throw new Error("Allocate asyncify data failed");
  }
  return wasm64 ? { wasm64, dataPtr, start: dataPtr + 16, end: dataPtr + 16 + size } : { wasm64, dataPtr, start: dataPtr + 8, end: dataPtr + 8 + size };
}
function validateImports(imports2) {
  if (imports2 && typeof imports2 !== "object") {
    throw new TypeError("imports must be an object or undefined");
  }
}
function fetchWasm(urlOrBuffer, imports2) {
  if (typeof wx !== "undefined" && typeof __wxConfig !== "undefined") {
    return _WebAssembly.instantiate(urlOrBuffer, imports2);
  }
  return fetch(urlOrBuffer).then((response) => response.arrayBuffer()).then((buffer) => _WebAssembly.instantiate(buffer, imports2));
}
function load(wasmInput, imports2) {
  validateImports(imports2);
  imports2 = imports2 !== null && imports2 !== void 0 ? imports2 : {};
  let source;
  if (wasmInput instanceof ArrayBuffer || ArrayBuffer.isView(wasmInput)) {
    return _WebAssembly.instantiate(wasmInput, imports2);
  }
  if (wasmInput instanceof _WebAssembly.Module) {
    return _WebAssembly.instantiate(wasmInput, imports2).then((instance) => {
      return { instance, module: wasmInput };
    });
  }
  if (typeof wasmInput !== "string" && !(wasmInput instanceof URL)) {
    throw new TypeError("Invalid source");
  }
  if (typeof _WebAssembly.instantiateStreaming === "function") {
    let responsePromise;
    try {
      responsePromise = fetch(wasmInput);
      source = _WebAssembly.instantiateStreaming(responsePromise, imports2).catch(() => {
        return fetchWasm(wasmInput, imports2);
      });
    } catch (_) {
      source = fetchWasm(wasmInput, imports2);
    }
  } else {
    source = fetchWasm(wasmInput, imports2);
  }
  return source;
}
function asyncifyLoad(asyncify, urlOrBuffer, imports2) {
  validateImports(imports2);
  imports2 = imports2 !== null && imports2 !== void 0 ? imports2 : {};
  const asyncifyHelper = new Asyncify();
  imports2 = asyncifyHelper.wrapImports(imports2);
  return load(urlOrBuffer, imports2).then((source) => {
    var _a;
    const memory = source.instance.exports.memory || ((_a = imports2.env) === null || _a === void 0 ? void 0 : _a.memory);
    return { module: source.module, instance: asyncifyHelper.init(memory, source.instance, asyncify) };
  });
}
function loadSync(wasmInput, imports2) {
  validateImports(imports2);
  imports2 = imports2 !== null && imports2 !== void 0 ? imports2 : {};
  let module2;
  if (wasmInput instanceof ArrayBuffer || ArrayBuffer.isView(wasmInput)) {
    module2 = new _WebAssembly.Module(wasmInput);
  } else if (wasmInput instanceof WebAssembly.Module) {
    module2 = wasmInput;
  } else {
    throw new TypeError("Invalid source");
  }
  const instance = new _WebAssembly.Instance(module2, imports2);
  const source = { instance, module: module2 };
  return source;
}
function asyncifyLoadSync(asyncify, buffer, imports2) {
  var _a;
  validateImports(imports2);
  imports2 = imports2 !== null && imports2 !== void 0 ? imports2 : {};
  const asyncifyHelper = new Asyncify();
  imports2 = asyncifyHelper.wrapImports(imports2);
  const source = loadSync(buffer, imports2);
  const memory = source.instance.exports.memory || ((_a = imports2.env) === null || _a === void 0 ? void 0 : _a.memory);
  return { module: source.module, instance: asyncifyHelper.init(memory, source.instance, asyncify) };
}
function isPosixPathSeparator(code) {
  return code === CHAR_FORWARD_SLASH;
}
function normalizeString(path, allowAboveRoot, separator, isPathSeparator) {
  let res = "";
  let lastSegmentLength = 0;
  let lastSlash = -1;
  let dots = 0;
  let code = 0;
  for (let i = 0; i <= path.length; ++i) {
    if (i < path.length) {
      code = path.charCodeAt(i);
    } else if (isPathSeparator(code)) {
      break;
    } else {
      code = CHAR_FORWARD_SLASH;
    }
    if (isPathSeparator(code)) {
      if (lastSlash === i - 1 || dots === 1) ;
      else if (dots === 2) {
        if (res.length < 2 || lastSegmentLength !== 2 || res.charCodeAt(res.length - 1) !== CHAR_DOT || res.charCodeAt(res.length - 2) !== CHAR_DOT) {
          if (res.length > 2) {
            const lastSlashIndex = res.indexOf(separator);
            if (lastSlashIndex === -1) {
              res = "";
              lastSegmentLength = 0;
            } else {
              res = res.slice(0, lastSlashIndex);
              lastSegmentLength = res.length - 1 - res.indexOf(separator);
            }
            lastSlash = i;
            dots = 0;
            continue;
          } else if (res.length !== 0) {
            res = "";
            lastSegmentLength = 0;
            lastSlash = i;
            dots = 0;
            continue;
          }
        }
        if (allowAboveRoot) {
          res += res.length > 0 ? `${separator}..` : "..";
          lastSegmentLength = 2;
        }
      } else {
        if (res.length > 0) {
          res += `${separator}${path.slice(lastSlash + 1, i)}`;
        } else {
          res = path.slice(lastSlash + 1, i);
        }
        lastSegmentLength = i - lastSlash - 1;
      }
      lastSlash = i;
      dots = 0;
    } else if (code === CHAR_DOT && dots !== -1) {
      ++dots;
    } else {
      dots = -1;
    }
  }
  return res;
}
function resolve(...args) {
  let resolvedPath = "";
  let resolvedAbsolute = false;
  for (let i = args.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    const path = i >= 0 ? args[i] : "/";
    validateString(path, "path");
    if (path.length === 0) {
      continue;
    }
    resolvedPath = `${path}/${resolvedPath}`;
    resolvedAbsolute = path.charCodeAt(0) === CHAR_FORWARD_SLASH;
  }
  resolvedPath = normalizeString(resolvedPath, !resolvedAbsolute, "/", isPosixPathSeparator);
  if (resolvedAbsolute) {
    return `/${resolvedPath}`;
  }
  return resolvedPath.length > 0 ? resolvedPath : ".";
}
function strerror(errno) {
  switch (errno) {
    case 0:
      return "Success";
    case 1:
      return "Argument list too long";
    case 2:
      return "Permission denied";
    case 3:
      return "Address in use";
    case 4:
      return "Address not available";
    case 5:
      return "Address family not supported by protocol";
    case 6:
      return "Resource temporarily unavailable";
    case 7:
      return "Operation already in progress";
    case 8:
      return "Bad file descriptor";
    case 9:
      return "Bad message";
    case 10:
      return "Resource busy";
    case 11:
      return "Operation canceled";
    case 12:
      return "No child process";
    case 13:
      return "Connection aborted";
    case 14:
      return "Connection refused";
    case 15:
      return "Connection reset by peer";
    case 16:
      return "Resource deadlock would occur";
    case 17:
      return "Destination address required";
    case 18:
      return "Domain error";
    case 19:
      return "Quota exceeded";
    case 20:
      return "File exists";
    case 21:
      return "Bad address";
    case 22:
      return "File too large";
    case 23:
      return "Host is unreachable";
    case 24:
      return "Identifier removed";
    case 25:
      return "Illegal byte sequence";
    case 26:
      return "Operation in progress";
    case 27:
      return "Interrupted system call";
    case 28:
      return "Invalid argument";
    case 29:
      return "I/O error";
    case 30:
      return "Socket is connected";
    case 31:
      return "Is a directory";
    case 32:
      return "Symbolic link loop";
    case 33:
      return "No file descriptors available";
    case 34:
      return "Too many links";
    case 35:
      return "Message too large";
    case 36:
      return "Multihop attempted";
    case 37:
      return "Filename too long";
    case 38:
      return "Network is down";
    case 39:
      return "Connection reset by network";
    case 40:
      return "Network unreachable";
    case 41:
      return "Too many files open in system";
    case 42:
      return "No buffer space available";
    case 43:
      return "No such device";
    case 44:
      return "No such file or directory";
    case 45:
      return "Exec format error";
    case 46:
      return "No locks available";
    case 47:
      return "Link has been severed";
    case 48:
      return "Out of memory";
    case 49:
      return "No message of the desired type";
    case 50:
      return "Protocol not available";
    case 51:
      return "No space left on device";
    case 52:
      return "Function not implemented";
    case 53:
      return "Socket not connected";
    case 54:
      return "Not a directory";
    case 55:
      return "Directory not empty";
    case 56:
      return "State not recoverable";
    case 57:
      return "Not a socket";
    case 58:
      return "Not supported";
    case 59:
      return "Not a tty";
    case 60:
      return "No such device or address";
    case 61:
      return "Value too large for data type";
    case 62:
      return "Previous owner died";
    case 63:
      return "Operation not permitted";
    case 64:
      return "Broken pipe";
    case 65:
      return "Protocol error";
    case 66:
      return "Protocol not supported";
    case 67:
      return "Protocol wrong type for socket";
    case 68:
      return "Result not representable";
    case 69:
      return "Read-only file system";
    case 70:
      return "Invalid seek";
    case 71:
      return "No such process";
    case 72:
      return "Stale file handle";
    case 73:
      return "Operation timed out";
    case 74:
      return "Text file busy";
    case 75:
      return "Cross-device link";
    case 76:
      return "Capabilities insufficient";
    default:
      return "Unknown error";
  }
}
function getRights(stdio, fd, flags, type) {
  const ret = {
    base: BigInt(0),
    inheriting: BigInt(0)
  };
  if (type === 0) {
    throw new WasiError(
      "Unknown file type",
      28
      /* WasiErrno.EINVAL */
    );
  }
  switch (type) {
    case 4:
      ret.base = REGULAR_FILE_BASE;
      ret.inheriting = REGULAR_FILE_INHERITING;
      break;
    case 3:
      ret.base = DIRECTORY_BASE;
      ret.inheriting = DIRECTORY_INHERITING;
      break;
    case 6:
    case 5:
      ret.base = SOCKET_BASE;
      ret.inheriting = SOCKET_INHERITING;
      break;
    case 2:
      if (stdio.indexOf(fd) !== -1) {
        ret.base = TTY_BASE;
        ret.inheriting = TTY_INHERITING;
      } else {
        ret.base = CHARACTER_DEVICE_BASE;
        ret.inheriting = CHARACTER_DEVICE_INHERITING;
      }
      break;
    case 1:
      ret.base = BLOCK_DEVICE_BASE;
      ret.inheriting = BLOCK_DEVICE_INHERITING;
      break;
    default:
      ret.base = BigInt(0);
      ret.inheriting = BigInt(0);
  }
  const read_or_write_only = flags & (0 | 1 | 2);
  if (read_or_write_only === 0) {
    ret.base &= ~WasiRights.FD_WRITE;
  } else if (read_or_write_only === 1) {
    ret.base &= ~WasiRights.FD_READ;
  }
  return ret;
}
function concatBuffer(buffers, size) {
  let total = 0;
  if (typeof size === "number" && size >= 0) {
    total = size;
  } else {
    for (let i = 0; i < buffers.length; i++) {
      const buffer = buffers[i];
      total += buffer.length;
    }
  }
  let pos = 0;
  const ret = new Uint8Array(total);
  for (let i = 0; i < buffers.length; i++) {
    const buffer = buffers[i];
    ret.set(buffer, pos);
    pos += buffer.length;
  }
  return ret;
}
function toFileType(stat) {
  if (stat.isBlockDevice())
    return 1;
  if (stat.isCharacterDevice())
    return 2;
  if (stat.isDirectory())
    return 3;
  if (stat.isSocket())
    return 6;
  if (stat.isFile())
    return 4;
  if (stat.isSymbolicLink())
    return 7;
  return 0;
}
function toFileStat(view, buf, stat) {
  view.setBigUint64(buf, stat.dev, true);
  view.setBigUint64(buf + 8, stat.ino, true);
  view.setBigUint64(buf + 16, BigInt(toFileType(stat)), true);
  view.setBigUint64(buf + 24, stat.nlink, true);
  view.setBigUint64(buf + 32, stat.size, true);
  view.setBigUint64(buf + 40, stat.atimeMs * BigInt(1e6), true);
  view.setBigUint64(buf + 48, stat.mtimeMs * BigInt(1e6), true);
  view.setBigUint64(buf + 56, stat.ctimeMs * BigInt(1e6), true);
}
function extendMemory(memory) {
  if (Object.getPrototypeOf(memory) === _WebAssembly.Memory.prototype) {
    Object.setPrototypeOf(memory, Memory.prototype);
  }
  return memory;
}
function checkWebAssemblyFunction() {
  const WebAssemblyFunction = _WebAssembly.Function;
  if (typeof WebAssemblyFunction !== "function") {
    throw new Error('WebAssembly.Function is not supported in this environment. If you are using V8 based browser like Chrome, try to specify --js-flags="--wasm-staging --experimental-wasm-stack-switching"');
  }
  return WebAssemblyFunction;
}
function wrapAsyncImport(f, parameterType, returnType) {
  const WebAssemblyFunction = checkWebAssemblyFunction();
  if (typeof f !== "function") {
    throw new TypeError("Function required");
  }
  const parameters = parameterType.slice(0);
  parameters.unshift("externref");
  return new WebAssemblyFunction({ parameters, results: returnType }, f, { suspending: "first" });
}
function wrapAsyncExport(f) {
  const WebAssemblyFunction = checkWebAssemblyFunction();
  if (typeof f !== "function") {
    throw new TypeError("Function required");
  }
  return new WebAssemblyFunction({ parameters: [...WebAssemblyFunction.type(f).parameters.slice(1)], results: ["externref"] }, f, { promising: "first" });
}
function wrapExports(exports2, needWrap) {
  return wrapInstanceExports(exports2, (exportValue, name) => {
    let ignore = typeof exportValue !== "function";
    if (Array.isArray(needWrap)) {
      ignore = ignore || needWrap.indexOf(name) === -1;
    }
    return ignore ? exportValue : wrapAsyncExport(exportValue);
  });
}
function copyMemory(targets, src) {
  if (targets.length === 0 || src.length === 0)
    return 0;
  let copied = 0;
  let left = src.length - copied;
  for (let i = 0; i < targets.length; ++i) {
    const target = targets[i];
    if (left < target.length) {
      target.set(src.subarray(copied, copied + left), 0);
      copied += left;
      left = 0;
      return copied;
    }
    target.set(src.subarray(copied, copied + target.length), 0);
    copied += target.length;
    left -= target.length;
  }
  return copied;
}
function getMemory(wasi2) {
  return _memory.get(wasi2);
}
function getFs(wasi2) {
  const fs2 = _fs.get(wasi2);
  if (!fs2)
    throw new Error("filesystem is unavailable");
  return fs2;
}
function handleError(err) {
  if (err instanceof WasiError) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(err);
    }
    return err.errno;
  }
  switch (err.code) {
    case "ENOENT":
      return 44;
    case "EBADF":
      return 8;
    case "EINVAL":
      return 28;
    case "EPERM":
      return 63;
    case "EPROTO":
      return 65;
    case "EEXIST":
      return 20;
    case "ENOTDIR":
      return 54;
    case "EMFILE":
      return 33;
    case "EACCES":
      return 2;
    case "EISDIR":
      return 31;
    case "ENOTEMPTY":
      return 55;
    case "ENOSYS":
      return 52;
  }
  throw err;
}
function defineName(name, f) {
  Object.defineProperty(f, "name", { value: name });
  return f;
}
function syscallWrap(self, name, f) {
  return defineName(name, function() {
    if (process.env.NODE_DEBUG_NATIVE === "wasi") {
      const args = Array.prototype.slice.call(arguments);
      let debugArgs = [`${name}(${Array.from({ length: arguments.length }).map(() => "%d").join(", ")})`];
      debugArgs = debugArgs.concat(args);
      console.debug.apply(console, debugArgs);
    }
    let r;
    try {
      r = f.apply(self, arguments);
    } catch (err) {
      return handleError(err);
    }
    if (isPromiseLike(r)) {
      return r.then((_) => _, handleError);
    }
    return r;
  });
}
function resolvePathSync(fs2, fileDescriptor, path, flags) {
  let resolvedPath = resolve(fileDescriptor.realPath, path);
  if ((flags & 1) === 1) {
    try {
      resolvedPath = fs2.readlinkSync(resolvedPath);
    } catch (err) {
      if (err.code !== "EINVAL" && err.code !== "ENOENT") {
        throw err;
      }
    }
  }
  return resolvedPath;
}
async function resolvePathAsync(fs2, fileDescriptor, path, flags) {
  let resolvedPath = resolve(fileDescriptor.realPath, path);
  if ((flags & 1) === 1) {
    try {
      resolvedPath = await fs2.promises.readlink(resolvedPath);
    } catch (err) {
      if (err.code !== "EINVAL" && err.code !== "ENOENT") {
        throw err;
      }
    }
  }
  return resolvedPath;
}
function readStdin() {
  const value = window.prompt();
  if (value === null)
    return new Uint8Array();
  const buffer = new TextEncoder().encode(value + "\n");
  return buffer;
}
function validateFstFlagsOrReturn(flags) {
  return Boolean(flags & ~(1 | 2 | 4 | 8)) || (flags & (1 | 2)) === (1 | 2) || (flags & (4 | 8)) === (4 | 8);
}
function setupInstance(self, instance) {
  validateObject(instance, "instance");
  validateObject(instance.exports, "instance.exports");
  self[kInstance] = instance;
  self[kSetMemory](instance.exports.memory);
}
function validateOptions(options) {
  var _a;
  validateObject(options, "options");
  let _WASI;
  if (options.version !== void 0) {
    validateString(options.version, "options.version");
    switch (options.version) {
      case "unstable":
        _WASI = WASI$1;
        this[kBindingName] = "wasi_unstable";
        break;
      case "preview1":
        _WASI = WASI$1;
        this[kBindingName] = "wasi_snapshot_preview1";
        break;
      default:
        throw new TypeError(`unsupported WASI version "${options.version}"`);
    }
  } else {
    _WASI = WASI$1;
    this[kBindingName] = "wasi_snapshot_preview1";
  }
  if (options.args !== void 0) {
    validateArray(options.args, "options.args");
  }
  const args = ((_a = options.args) !== null && _a !== void 0 ? _a : []).map(String);
  const env = [];
  if (options.env !== void 0) {
    validateObject(options.env, "options.env");
    Object.entries(options.env).forEach(({ 0: key, 1: value }) => {
      if (value !== void 0) {
        env.push(`${key}=${value}`);
      }
    });
  }
  const preopens = [];
  if (options.preopens !== void 0) {
    validateObject(options.preopens, "options.preopens");
    Object.entries(options.preopens).forEach(({ 0: key, 1: value }) => preopens.push({ mappedPath: String(key), realPath: String(value) }));
  }
  if (preopens.length > 0) {
    if (options.fs === void 0) {
      throw new Error("filesystem is disabled, can not preopen directory");
    }
    try {
      validateObject(options.fs, "options.fs");
    } catch (_) {
      throw new TypeError("Node.js fs like implementation is not provided");
    }
  }
  if (options.print !== void 0)
    validateFunction(options.print, "options.print");
  if (options.printErr !== void 0)
    validateFunction(options.printErr, "options.printErr");
  if (options.returnOnExit !== void 0) {
    validateBoolean(options.returnOnExit, "options.returnOnExit");
  }
  const stdio = [0, 1, 2];
  return {
    args,
    env,
    preopens,
    stdio,
    _WASI
  };
}
function initWASI(setMemory, wrap) {
  this[kSetMemory] = setMemory;
  this.wasiImport = wrap;
  this[kStarted] = false;
  this[kExitCode] = 0;
  this[kInstance] = void 0;
}
function wasiReturnOnProcExit(rval) {
  this[kExitCode] = rval;
  throw kExitCode;
}
async function createAsyncWASI(options = kEmptyObject) {
  const _this = Object.create(WASI.prototype);
  const { args, env, preopens, stdio, _WASI } = validateOptions.call(_this, options);
  if (options.asyncify !== void 0) {
    validateObject(options.asyncify, "options.asyncify");
    validateFunction(options.asyncify.wrapImportFunction, "options.asyncify.wrapImportFunction");
  }
  const wrap = await _WASI.createAsync(args, env, preopens, stdio, options.fs, options.print, options.printErr, options.asyncify);
  const setMemory = wrap._setMemory;
  delete wrap._setMemory;
  initWASI.call(_this, setMemory, wrap);
  if (options.returnOnExit) {
    wrap.proc_exit = wasiReturnOnProcExit.bind(_this);
  }
  return _this;
}
var _WebAssembly, ignoreNames, Asyncify, CHAR_DOT, CHAR_FORWARD_SLASH, FD_DATASYNC, FD_READ, FD_SEEK, FD_FDSTAT_SET_FLAGS, FD_SYNC, FD_TELL, FD_WRITE, FD_ADVISE, FD_ALLOCATE, PATH_CREATE_DIRECTORY, PATH_CREATE_FILE, PATH_LINK_SOURCE, PATH_LINK_TARGET, PATH_OPEN, FD_READDIR, PATH_READLINK, PATH_RENAME_SOURCE, PATH_RENAME_TARGET, PATH_FILESTAT_GET, PATH_FILESTAT_SET_SIZE, PATH_FILESTAT_SET_TIMES, FD_FILESTAT_GET, FD_FILESTAT_SET_SIZE, FD_FILESTAT_SET_TIMES, PATH_SYMLINK, PATH_REMOVE_DIRECTORY, PATH_UNLINK_FILE, POLL_FD_READWRITE, SOCK_SHUTDOWN, SOCK_ACCEPT, WasiRights, WasiError, RIGHTS_ALL, BLOCK_DEVICE_BASE, BLOCK_DEVICE_INHERITING, CHARACTER_DEVICE_BASE, CHARACTER_DEVICE_INHERITING, REGULAR_FILE_BASE, REGULAR_FILE_INHERITING, DIRECTORY_BASE, DIRECTORY_INHERITING, SOCKET_BASE, SOCKET_INHERITING, TTY_BASE, TTY_INHERITING, FileDescriptor, StandardOutput, FileDescriptorTable, SyncTable, AsyncTable, WebAssemblyMemory, Memory, _memory, _wasi, _fs, encoder, decoder, INT64_MAX, WASI$1, kEmptyObject, kExitCode, kSetMemory, kStarted, kInstance, kBindingName, WASI;
var init_wasm_util_esm_bundler = __esm({
  "node_modules/.pnpm/@tybys+wasm-util@0.9.0/node_modules/@tybys/wasm-util/dist/wasm-util.esm-bundler.js"() {
    _WebAssembly = typeof WebAssembly !== "undefined" ? WebAssembly : typeof WXWebAssembly !== "undefined" ? WXWebAssembly : void 0;
    if (!_WebAssembly) {
      throw new Error("WebAssembly is not supported in this environment");
    }
    ignoreNames = [
      "asyncify_get_state",
      "asyncify_start_rewind",
      "asyncify_start_unwind",
      "asyncify_stop_rewind",
      "asyncify_stop_unwind"
    ];
    Asyncify = class {
      constructor() {
        this.value = void 0;
        this.exports = void 0;
        this.dataPtr = 0;
      }
      init(memory, instance, options) {
        var _a, _b;
        if (this.exports) {
          throw new Error("Asyncify has been initialized");
        }
        if (!(memory instanceof _WebAssembly.Memory)) {
          throw new TypeError("Require WebAssembly.Memory object");
        }
        const exports2 = instance.exports;
        for (let i = 0; i < ignoreNames.length; ++i) {
          if (typeof exports2[ignoreNames[i]] !== "function") {
            throw new TypeError("Invalid asyncify wasm");
          }
        }
        let address;
        const wasm64 = Boolean(options.wasm64);
        if (!options.tryAllocate) {
          address = {
            wasm64,
            dataPtr: 16,
            start: wasm64 ? 32 : 24,
            end: 1024
          };
        } else {
          if (options.tryAllocate === true) {
            address = tryAllocate(instance, wasm64, 4096, "malloc");
          } else {
            address = tryAllocate(instance, wasm64, (_a = options.tryAllocate.size) !== null && _a !== void 0 ? _a : 4096, (_b = options.tryAllocate.name) !== null && _b !== void 0 ? _b : "malloc");
          }
        }
        this.dataPtr = address.dataPtr;
        if (wasm64) {
          new BigInt64Array(memory.buffer, this.dataPtr).set([BigInt(address.start), BigInt(address.end)]);
        } else {
          new Int32Array(memory.buffer, this.dataPtr).set([address.start, address.end]);
        }
        this.exports = this.wrapExports(exports2, options.wrapExports);
        const asyncifiedInstance = Object.create(_WebAssembly.Instance.prototype);
        Object.defineProperty(asyncifiedInstance, "exports", { value: this.exports });
        return asyncifiedInstance;
      }
      assertState() {
        if (this.exports.asyncify_get_state() !== 0) {
          throw new Error("Asyncify state error");
        }
      }
      wrapImportFunction(f) {
        const _this = this;
        return function() {
          while (_this.exports.asyncify_get_state() === 2) {
            _this.exports.asyncify_stop_rewind();
            return _this.value;
          }
          _this.assertState();
          const v = f.apply(this, arguments);
          if (!isPromiseLike(v))
            return v;
          _this.exports.asyncify_start_unwind(_this.dataPtr);
          _this.value = v;
        };
      }
      wrapImports(imports2) {
        const importObject = {};
        Object.keys(imports2).forEach((k) => {
          const mod = imports2[k];
          const newModule = {};
          Object.keys(mod).forEach((name) => {
            const importValue = mod[name];
            if (typeof importValue === "function") {
              newModule[name] = this.wrapImportFunction(importValue);
            } else {
              newModule[name] = importValue;
            }
          });
          importObject[k] = newModule;
        });
        return importObject;
      }
      wrapExportFunction(f) {
        const _this = this;
        return async function() {
          _this.assertState();
          let ret = f.apply(this, arguments);
          while (_this.exports.asyncify_get_state() === 1) {
            _this.exports.asyncify_stop_unwind();
            _this.value = await _this.value;
            _this.assertState();
            _this.exports.asyncify_start_rewind(_this.dataPtr);
            ret = f.call(this);
          }
          _this.assertState();
          return ret;
        };
      }
      wrapExports(exports2, needWrap) {
        return wrapInstanceExports(exports2, (exportValue, name) => {
          let ignore = ignoreNames.indexOf(name) !== -1 || typeof exportValue !== "function";
          if (Array.isArray(needWrap)) {
            ignore = ignore || needWrap.indexOf(name) === -1;
          }
          return ignore ? exportValue : this.wrapExportFunction(exportValue);
        });
      }
    };
    CHAR_DOT = 46;
    CHAR_FORWARD_SLASH = 47;
    FD_DATASYNC = /* @__PURE__ */ BigInt(1) << /* @__PURE__ */ BigInt(0);
    FD_READ = /* @__PURE__ */ BigInt(1) << /* @__PURE__ */ BigInt(1);
    FD_SEEK = /* @__PURE__ */ BigInt(1) << /* @__PURE__ */ BigInt(2);
    FD_FDSTAT_SET_FLAGS = /* @__PURE__ */ BigInt(1) << /* @__PURE__ */ BigInt(3);
    FD_SYNC = /* @__PURE__ */ BigInt(1) << /* @__PURE__ */ BigInt(4);
    FD_TELL = /* @__PURE__ */ BigInt(1) << /* @__PURE__ */ BigInt(5);
    FD_WRITE = /* @__PURE__ */ BigInt(1) << /* @__PURE__ */ BigInt(6);
    FD_ADVISE = /* @__PURE__ */ BigInt(1) << /* @__PURE__ */ BigInt(7);
    FD_ALLOCATE = /* @__PURE__ */ BigInt(1) << /* @__PURE__ */ BigInt(8);
    PATH_CREATE_DIRECTORY = /* @__PURE__ */ BigInt(1) << /* @__PURE__ */ BigInt(9);
    PATH_CREATE_FILE = /* @__PURE__ */ BigInt(1) << /* @__PURE__ */ BigInt(10);
    PATH_LINK_SOURCE = /* @__PURE__ */ BigInt(1) << /* @__PURE__ */ BigInt(11);
    PATH_LINK_TARGET = /* @__PURE__ */ BigInt(1) << /* @__PURE__ */ BigInt(12);
    PATH_OPEN = /* @__PURE__ */ BigInt(1) << /* @__PURE__ */ BigInt(13);
    FD_READDIR = /* @__PURE__ */ BigInt(1) << /* @__PURE__ */ BigInt(14);
    PATH_READLINK = /* @__PURE__ */ BigInt(1) << /* @__PURE__ */ BigInt(15);
    PATH_RENAME_SOURCE = /* @__PURE__ */ BigInt(1) << /* @__PURE__ */ BigInt(16);
    PATH_RENAME_TARGET = /* @__PURE__ */ BigInt(1) << /* @__PURE__ */ BigInt(17);
    PATH_FILESTAT_GET = /* @__PURE__ */ BigInt(1) << /* @__PURE__ */ BigInt(18);
    PATH_FILESTAT_SET_SIZE = /* @__PURE__ */ BigInt(1) << /* @__PURE__ */ BigInt(19);
    PATH_FILESTAT_SET_TIMES = /* @__PURE__ */ BigInt(1) << /* @__PURE__ */ BigInt(20);
    FD_FILESTAT_GET = /* @__PURE__ */ BigInt(1) << /* @__PURE__ */ BigInt(21);
    FD_FILESTAT_SET_SIZE = /* @__PURE__ */ BigInt(1) << /* @__PURE__ */ BigInt(22);
    FD_FILESTAT_SET_TIMES = /* @__PURE__ */ BigInt(1) << /* @__PURE__ */ BigInt(23);
    PATH_SYMLINK = /* @__PURE__ */ BigInt(1) << /* @__PURE__ */ BigInt(24);
    PATH_REMOVE_DIRECTORY = /* @__PURE__ */ BigInt(1) << /* @__PURE__ */ BigInt(25);
    PATH_UNLINK_FILE = /* @__PURE__ */ BigInt(1) << /* @__PURE__ */ BigInt(26);
    POLL_FD_READWRITE = /* @__PURE__ */ BigInt(1) << /* @__PURE__ */ BigInt(27);
    SOCK_SHUTDOWN = /* @__PURE__ */ BigInt(1) << /* @__PURE__ */ BigInt(28);
    SOCK_ACCEPT = /* @__PURE__ */ BigInt(1) << /* @__PURE__ */ BigInt(29);
    WasiRights = {
      FD_DATASYNC,
      FD_READ,
      FD_SEEK,
      FD_FDSTAT_SET_FLAGS,
      FD_SYNC,
      FD_TELL,
      FD_WRITE,
      FD_ADVISE,
      FD_ALLOCATE,
      PATH_CREATE_DIRECTORY,
      PATH_CREATE_FILE,
      PATH_LINK_SOURCE,
      PATH_LINK_TARGET,
      PATH_OPEN,
      FD_READDIR,
      PATH_READLINK,
      PATH_RENAME_SOURCE,
      PATH_RENAME_TARGET,
      PATH_FILESTAT_GET,
      PATH_FILESTAT_SET_SIZE,
      PATH_FILESTAT_SET_TIMES,
      FD_FILESTAT_GET,
      FD_FILESTAT_SET_SIZE,
      FD_FILESTAT_SET_TIMES,
      PATH_SYMLINK,
      PATH_REMOVE_DIRECTORY,
      PATH_UNLINK_FILE,
      POLL_FD_READWRITE,
      SOCK_SHUTDOWN,
      SOCK_ACCEPT
    };
    WasiError = class extends Error {
      constructor(message, errno) {
        super(message);
        this.errno = errno;
      }
      getErrorMessage() {
        return strerror(this.errno);
      }
    };
    Object.defineProperty(WasiError.prototype, "name", {
      configurable: true,
      writable: true,
      value: "WasiError"
    });
    RIGHTS_ALL = WasiRights.FD_DATASYNC | WasiRights.FD_READ | WasiRights.FD_SEEK | WasiRights.FD_FDSTAT_SET_FLAGS | WasiRights.FD_SYNC | WasiRights.FD_TELL | WasiRights.FD_WRITE | WasiRights.FD_ADVISE | WasiRights.FD_ALLOCATE | WasiRights.PATH_CREATE_DIRECTORY | WasiRights.PATH_CREATE_FILE | WasiRights.PATH_LINK_SOURCE | WasiRights.PATH_LINK_TARGET | WasiRights.PATH_OPEN | WasiRights.FD_READDIR | WasiRights.PATH_READLINK | WasiRights.PATH_RENAME_SOURCE | WasiRights.PATH_RENAME_TARGET | WasiRights.PATH_FILESTAT_GET | WasiRights.PATH_FILESTAT_SET_SIZE | WasiRights.PATH_FILESTAT_SET_TIMES | WasiRights.FD_FILESTAT_GET | WasiRights.FD_FILESTAT_SET_TIMES | WasiRights.FD_FILESTAT_SET_SIZE | WasiRights.PATH_SYMLINK | WasiRights.PATH_UNLINK_FILE | WasiRights.PATH_REMOVE_DIRECTORY | WasiRights.POLL_FD_READWRITE | WasiRights.SOCK_SHUTDOWN | WasiRights.SOCK_ACCEPT;
    BLOCK_DEVICE_BASE = RIGHTS_ALL;
    BLOCK_DEVICE_INHERITING = RIGHTS_ALL;
    CHARACTER_DEVICE_BASE = RIGHTS_ALL;
    CHARACTER_DEVICE_INHERITING = RIGHTS_ALL;
    REGULAR_FILE_BASE = WasiRights.FD_DATASYNC | WasiRights.FD_READ | WasiRights.FD_SEEK | WasiRights.FD_FDSTAT_SET_FLAGS | WasiRights.FD_SYNC | WasiRights.FD_TELL | WasiRights.FD_WRITE | WasiRights.FD_ADVISE | WasiRights.FD_ALLOCATE | WasiRights.FD_FILESTAT_GET | WasiRights.FD_FILESTAT_SET_SIZE | WasiRights.FD_FILESTAT_SET_TIMES | WasiRights.POLL_FD_READWRITE;
    REGULAR_FILE_INHERITING = /* @__PURE__ */ BigInt(0);
    DIRECTORY_BASE = WasiRights.FD_FDSTAT_SET_FLAGS | WasiRights.FD_SYNC | WasiRights.FD_ADVISE | WasiRights.PATH_CREATE_DIRECTORY | WasiRights.PATH_CREATE_FILE | WasiRights.PATH_LINK_SOURCE | WasiRights.PATH_LINK_TARGET | WasiRights.PATH_OPEN | WasiRights.FD_READDIR | WasiRights.PATH_READLINK | WasiRights.PATH_RENAME_SOURCE | WasiRights.PATH_RENAME_TARGET | WasiRights.PATH_FILESTAT_GET | WasiRights.PATH_FILESTAT_SET_SIZE | WasiRights.PATH_FILESTAT_SET_TIMES | WasiRights.FD_FILESTAT_GET | WasiRights.FD_FILESTAT_SET_TIMES | WasiRights.PATH_SYMLINK | WasiRights.PATH_UNLINK_FILE | WasiRights.PATH_REMOVE_DIRECTORY | WasiRights.POLL_FD_READWRITE;
    DIRECTORY_INHERITING = DIRECTORY_BASE | REGULAR_FILE_BASE;
    SOCKET_BASE = WasiRights.FD_READ | WasiRights.FD_FDSTAT_SET_FLAGS | WasiRights.FD_WRITE | WasiRights.FD_FILESTAT_GET | WasiRights.POLL_FD_READWRITE | WasiRights.SOCK_SHUTDOWN;
    SOCKET_INHERITING = RIGHTS_ALL;
    TTY_BASE = WasiRights.FD_READ | WasiRights.FD_FDSTAT_SET_FLAGS | WasiRights.FD_WRITE | WasiRights.FD_FILESTAT_GET | WasiRights.POLL_FD_READWRITE;
    TTY_INHERITING = /* @__PURE__ */ BigInt(0);
    FileDescriptor = class {
      constructor(id, fd, path, realPath, type, rightsBase, rightsInheriting, preopen) {
        this.id = id;
        this.fd = fd;
        this.path = path;
        this.realPath = realPath;
        this.type = type;
        this.rightsBase = rightsBase;
        this.rightsInheriting = rightsInheriting;
        this.preopen = preopen;
        this.pos = BigInt(0);
        this.size = BigInt(0);
      }
      seek(offset, whence) {
        if (whence === 0) {
          this.pos = BigInt(offset);
        } else if (whence === 1) {
          this.pos += BigInt(offset);
        } else if (whence === 2) {
          this.pos = BigInt(this.size) - BigInt(offset);
        } else {
          throw new WasiError(
            "Unknown whence",
            29
            /* WasiErrno.EIO */
          );
        }
        return this.pos;
      }
    };
    StandardOutput = class extends FileDescriptor {
      constructor(log, id, fd, path, realPath, type, rightsBase, rightsInheriting, preopen) {
        super(id, fd, path, realPath, type, rightsBase, rightsInheriting, preopen);
        this._log = log;
        this._buf = null;
      }
      write(buffer) {
        const originalBuffer = buffer;
        if (this._buf) {
          buffer = concatBuffer([this._buf, buffer]);
          this._buf = null;
        }
        if (buffer.indexOf(10) === -1) {
          this._buf = buffer;
          return originalBuffer.byteLength;
        }
        let written = 0;
        let lastBegin = 0;
        let index;
        while ((index = buffer.indexOf(10, written)) !== -1) {
          const str = new TextDecoder().decode(buffer.subarray(lastBegin, index));
          this._log(str);
          written += index - lastBegin + 1;
          lastBegin = index + 1;
        }
        if (written < buffer.length) {
          this._buf = buffer.slice(written);
        }
        return originalBuffer.byteLength;
      }
    };
    FileDescriptorTable = class {
      constructor(options) {
        this.used = 0;
        this.size = options.size;
        this.fds = Array(options.size);
        this.stdio = [options.in, options.out, options.err];
        this.print = options.print;
        this.printErr = options.printErr;
        this.insertStdio(options.in, 0, "<stdin>");
        this.insertStdio(options.out, 1, "<stdout>");
        this.insertStdio(options.err, 2, "<stderr>");
      }
      insertStdio(fd, expected, name) {
        const type = 2;
        const { base, inheriting } = getRights(this.stdio, fd, 2, type);
        const wrap = this.insert(fd, name, name, type, base, inheriting, 0);
        if (wrap.id !== expected) {
          throw new WasiError(
            `id: ${wrap.id} !== expected: ${expected}`,
            8
            /* WasiErrno.EBADF */
          );
        }
        return wrap;
      }
      insert(fd, mappedPath, realPath, type, rightsBase, rightsInheriting, preopen) {
        var _a, _b;
        let index = -1;
        if (this.used >= this.size) {
          const newSize = this.size * 2;
          this.fds.length = newSize;
          index = this.size;
          this.size = newSize;
        } else {
          for (let i = 0; i < this.size; ++i) {
            if (this.fds[i] == null) {
              index = i;
              break;
            }
          }
        }
        let entry;
        if (mappedPath === "<stdout>") {
          entry = new StandardOutput((_a = this.print) !== null && _a !== void 0 ? _a : console.log, index, fd, mappedPath, realPath, type, rightsBase, rightsInheriting, preopen);
        } else if (mappedPath === "<stderr>") {
          entry = new StandardOutput((_b = this.printErr) !== null && _b !== void 0 ? _b : console.error, index, fd, mappedPath, realPath, type, rightsBase, rightsInheriting, preopen);
        } else {
          entry = new FileDescriptor(index, fd, mappedPath, realPath, type, rightsBase, rightsInheriting, preopen);
        }
        this.fds[index] = entry;
        this.used++;
        return entry;
      }
      get(id, base, inheriting) {
        if (id >= this.size) {
          throw new WasiError(
            "Invalid fd",
            8
            /* WasiErrno.EBADF */
          );
        }
        const entry = this.fds[id];
        if (!entry || entry.id !== id) {
          throw new WasiError(
            "Bad file descriptor",
            8
            /* WasiErrno.EBADF */
          );
        }
        if ((~entry.rightsBase & base) !== BigInt(0) || (~entry.rightsInheriting & inheriting) !== BigInt(0)) {
          throw new WasiError(
            "Capabilities insufficient",
            76
            /* WasiErrno.ENOTCAPABLE */
          );
        }
        return entry;
      }
      remove(id) {
        if (id >= this.size) {
          throw new WasiError(
            "Invalid fd",
            8
            /* WasiErrno.EBADF */
          );
        }
        const entry = this.fds[id];
        if (!entry || entry.id !== id) {
          throw new WasiError(
            "Bad file descriptor",
            8
            /* WasiErrno.EBADF */
          );
        }
        this.fds[id] = void 0;
        this.used--;
      }
    };
    SyncTable = class extends FileDescriptorTable {
      constructor(options) {
        super(options);
        this.fs = options.fs;
      }
      getFileTypeByFd(fd) {
        const stats = this.fs.fstatSync(fd, { bigint: true });
        return toFileType(stats);
      }
      insertPreopen(fd, mappedPath, realPath) {
        const type = this.getFileTypeByFd(fd);
        if (type !== 3) {
          throw new WasiError(
            `Preopen not dir: ["${mappedPath}", "${realPath}"]`,
            54
            /* WasiErrno.ENOTDIR */
          );
        }
        const result = getRights(this.stdio, fd, 0, type);
        return this.insert(fd, mappedPath, realPath, type, result.base, result.inheriting, 1);
      }
      renumber(dst, src) {
        if (dst === src)
          return;
        if (dst >= this.size || src >= this.size) {
          throw new WasiError(
            "Invalid fd",
            8
            /* WasiErrno.EBADF */
          );
        }
        const dstEntry = this.fds[dst];
        const srcEntry = this.fds[src];
        if (!dstEntry || !srcEntry || dstEntry.id !== dst || srcEntry.id !== src) {
          throw new WasiError(
            "Invalid fd",
            8
            /* WasiErrno.EBADF */
          );
        }
        this.fs.closeSync(dstEntry.fd);
        this.fds[dst] = this.fds[src];
        this.fds[dst].id = dst;
        this.fds[src] = void 0;
        this.used--;
      }
    };
    AsyncTable = class extends FileDescriptorTable {
      // eslint-disable-next-line @typescript-eslint/no-useless-constructor
      constructor(options) {
        super(options);
      }
      async getFileTypeByFd(fd) {
        const stats = await fd.stat({ bigint: true });
        return toFileType(stats);
      }
      async insertPreopen(fd, mappedPath, realPath) {
        const type = await this.getFileTypeByFd(fd);
        if (type !== 3) {
          throw new WasiError(
            `Preopen not dir: ["${mappedPath}", "${realPath}"]`,
            54
            /* WasiErrno.ENOTDIR */
          );
        }
        const result = getRights(this.stdio, fd.fd, 0, type);
        return this.insert(fd, mappedPath, realPath, type, result.base, result.inheriting, 1);
      }
      async renumber(dst, src) {
        if (dst === src)
          return;
        if (dst >= this.size || src >= this.size) {
          throw new WasiError(
            "Invalid fd",
            8
            /* WasiErrno.EBADF */
          );
        }
        const dstEntry = this.fds[dst];
        const srcEntry = this.fds[src];
        if (!dstEntry || !srcEntry || dstEntry.id !== dst || srcEntry.id !== src) {
          throw new WasiError(
            "Invalid fd",
            8
            /* WasiErrno.EBADF */
          );
        }
        await dstEntry.fd.close();
        this.fds[dst] = this.fds[src];
        this.fds[dst].id = dst;
        this.fds[src] = void 0;
        this.used--;
      }
    };
    WebAssemblyMemory = /* @__PURE__ */ function() {
      return _WebAssembly.Memory;
    }();
    Memory = class extends WebAssemblyMemory {
      // eslint-disable-next-line @typescript-eslint/no-useless-constructor
      constructor(descriptor) {
        super(descriptor);
      }
      get HEAP8() {
        return new Int8Array(super.buffer);
      }
      get HEAPU8() {
        return new Uint8Array(super.buffer);
      }
      get HEAP16() {
        return new Int16Array(super.buffer);
      }
      get HEAPU16() {
        return new Uint16Array(super.buffer);
      }
      get HEAP32() {
        return new Int32Array(super.buffer);
      }
      get HEAPU32() {
        return new Uint32Array(super.buffer);
      }
      get HEAP64() {
        return new BigInt64Array(super.buffer);
      }
      get HEAPU64() {
        return new BigUint64Array(super.buffer);
      }
      get HEAPF32() {
        return new Float32Array(super.buffer);
      }
      get HEAPF64() {
        return new Float64Array(super.buffer);
      }
      get view() {
        return new DataView(super.buffer);
      }
    };
    _memory = /* @__PURE__ */ new WeakMap();
    _wasi = /* @__PURE__ */ new WeakMap();
    _fs = /* @__PURE__ */ new WeakMap();
    encoder = /* @__PURE__ */ new TextEncoder();
    decoder = /* @__PURE__ */ new TextDecoder();
    INT64_MAX = (BigInt(1) << BigInt(63)) - BigInt(1);
    WASI$1 = class _WASI$1 {
      constructor(args, env, fds, asyncFs, fs2, asyncify) {
        this.args_get = syscallWrap(this, "args_get", function(argv, argv_buf) {
          argv = Number(argv);
          argv_buf = Number(argv_buf);
          if (argv === 0 || argv_buf === 0) {
            return 28;
          }
          const { HEAPU8, view } = getMemory(this);
          const wasi2 = _wasi.get(this);
          const args2 = wasi2.args;
          for (let i = 0; i < args2.length; ++i) {
            const arg = args2[i];
            view.setInt32(argv, argv_buf, true);
            argv += 4;
            const data = encoder.encode(arg + "\0");
            HEAPU8.set(data, argv_buf);
            argv_buf += data.length;
          }
          return 0;
        });
        this.args_sizes_get = syscallWrap(this, "args_sizes_get", function(argc, argv_buf_size) {
          argc = Number(argc);
          argv_buf_size = Number(argv_buf_size);
          if (argc === 0 || argv_buf_size === 0) {
            return 28;
          }
          const { view } = getMemory(this);
          const wasi2 = _wasi.get(this);
          const args2 = wasi2.args;
          view.setUint32(argc, args2.length, true);
          view.setUint32(argv_buf_size, encoder.encode(args2.join("\0") + "\0").length, true);
          return 0;
        });
        this.environ_get = syscallWrap(this, "environ_get", function(environ, environ_buf) {
          environ = Number(environ);
          environ_buf = Number(environ_buf);
          if (environ === 0 || environ_buf === 0) {
            return 28;
          }
          const { HEAPU8, view } = getMemory(this);
          const wasi2 = _wasi.get(this);
          const env2 = wasi2.env;
          for (let i = 0; i < env2.length; ++i) {
            const pair = env2[i];
            view.setInt32(environ, environ_buf, true);
            environ += 4;
            const data = encoder.encode(pair + "\0");
            HEAPU8.set(data, environ_buf);
            environ_buf += data.length;
          }
          return 0;
        });
        this.environ_sizes_get = syscallWrap(this, "environ_sizes_get", function(len, buflen) {
          len = Number(len);
          buflen = Number(buflen);
          if (len === 0 || buflen === 0) {
            return 28;
          }
          const { view } = getMemory(this);
          const wasi2 = _wasi.get(this);
          view.setUint32(len, wasi2.env.length, true);
          view.setUint32(buflen, encoder.encode(wasi2.env.join("\0") + "\0").length, true);
          return 0;
        });
        this.clock_res_get = syscallWrap(this, "clock_res_get", function(id, resolution) {
          resolution = Number(resolution);
          if (resolution === 0) {
            return 28;
          }
          const { view } = getMemory(this);
          switch (id) {
            case 0:
              view.setBigUint64(resolution, BigInt(1e6), true);
              return 0;
            case 1:
            case 2:
            case 3:
              view.setBigUint64(resolution, BigInt(1e3), true);
              return 0;
            default:
              return 28;
          }
        });
        this.clock_time_get = syscallWrap(this, "clock_time_get", function(id, _percision, time) {
          time = Number(time);
          if (time === 0) {
            return 28;
          }
          const { view } = getMemory(this);
          switch (id) {
            case 0:
              view.setBigUint64(time, BigInt(Date.now()) * BigInt(1e6), true);
              return 0;
            case 1:
            case 2:
            case 3: {
              const t = performance.now();
              const s = Math.trunc(t);
              const ms = Math.floor((t - s) * 1e3);
              const result = BigInt(s) * BigInt(1e9) + BigInt(ms) * BigInt(1e6);
              view.setBigUint64(time, result, true);
              return 0;
            }
            default:
              return 28;
          }
        });
        this.fd_advise = syscallWrap(this, "fd_advise", function(_fd, _offset, _len, _advice) {
          return 52;
        });
        this.fd_fdstat_get = syscallWrap(this, "fd_fdstat_get", function(fd, fdstat) {
          fdstat = Number(fdstat);
          if (fdstat === 0) {
            return 28;
          }
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, BigInt(0), BigInt(0));
          const { view } = getMemory(this);
          view.setUint16(fdstat, fileDescriptor.type, true);
          view.setUint16(fdstat + 2, 0, true);
          view.setBigUint64(fdstat + 8, fileDescriptor.rightsBase, true);
          view.setBigUint64(fdstat + 16, fileDescriptor.rightsInheriting, true);
          return 0;
        });
        this.fd_fdstat_set_flags = syscallWrap(this, "fd_fdstat_set_flags", function(_fd, _flags) {
          return 52;
        });
        this.fd_fdstat_set_rights = syscallWrap(this, "fd_fdstat_set_rights", function(fd, rightsBase, rightsInheriting) {
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, BigInt(0), BigInt(0));
          if ((rightsBase | fileDescriptor.rightsBase) > fileDescriptor.rightsBase) {
            return 76;
          }
          if ((rightsInheriting | fileDescriptor.rightsInheriting) > fileDescriptor.rightsInheriting) {
            return 76;
          }
          fileDescriptor.rightsBase = rightsBase;
          fileDescriptor.rightsInheriting = rightsInheriting;
          return 0;
        });
        this.fd_prestat_get = syscallWrap(this, "fd_prestat_get", function(fd, prestat) {
          prestat = Number(prestat);
          if (prestat === 0) {
            return 28;
          }
          const wasi2 = _wasi.get(this);
          let fileDescriptor;
          try {
            fileDescriptor = wasi2.fds.get(fd, BigInt(0), BigInt(0));
          } catch (err) {
            if (err instanceof WasiError)
              return err.errno;
            throw err;
          }
          if (fileDescriptor.preopen !== 1)
            return 28;
          const { view } = getMemory(this);
          view.setUint32(prestat, 0, true);
          view.setUint32(prestat + 4, encoder.encode(fileDescriptor.path).length, true);
          return 0;
        });
        this.fd_prestat_dir_name = syscallWrap(this, "fd_prestat_dir_name", function(fd, path, path_len) {
          path = Number(path);
          path_len = Number(path_len);
          if (path === 0) {
            return 28;
          }
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, BigInt(0), BigInt(0));
          if (fileDescriptor.preopen !== 1)
            return 8;
          const buffer = encoder.encode(fileDescriptor.path);
          const size = buffer.length;
          if (size > path_len)
            return 42;
          const { HEAPU8 } = getMemory(this);
          HEAPU8.set(buffer, path);
          return 0;
        });
        this.fd_seek = syscallWrap(this, "fd_seek", function(fd, offset, whence, newOffset) {
          newOffset = Number(newOffset);
          if (newOffset === 0) {
            return 28;
          }
          if (fd === 0 || fd === 1 || fd === 2)
            return 0;
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.FD_SEEK, BigInt(0));
          const r = fileDescriptor.seek(offset, whence);
          const { view } = getMemory(this);
          view.setBigUint64(newOffset, r, true);
          return 0;
        });
        this.fd_tell = syscallWrap(this, "fd_tell", function(fd, offset) {
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.FD_TELL, BigInt(0));
          const pos = BigInt(fileDescriptor.pos);
          const { view } = getMemory(this);
          view.setBigUint64(Number(offset), pos, true);
          return 0;
        });
        this.poll_oneoff = syscallWrap(this, "poll_oneoff", function(in_ptr, out_ptr, nsubscriptions, nevents) {
          in_ptr = Number(in_ptr);
          out_ptr = Number(out_ptr);
          nevents = Number(nevents);
          nsubscriptions = Number(nsubscriptions);
          nsubscriptions = nsubscriptions >>> 0;
          if (in_ptr === 0 || out_ptr === 0 || nsubscriptions === 0 || nevents === 0) {
            return 28;
          }
          const { view } = getMemory(this);
          view.setUint32(nevents, 0, true);
          let i = 0;
          let timer_userdata = BigInt(0);
          let cur_timeout = BigInt(0);
          let has_timeout = 0;
          let min_timeout = BigInt(0);
          let sub;
          const subscriptions = Array(nsubscriptions);
          for (i = 0; i < nsubscriptions; i++) {
            sub = in_ptr + i * 48;
            const userdata = view.getBigUint64(sub, true);
            const type = view.getUint8(sub + 8);
            const clockIdOrFd = view.getUint32(sub + 16, true);
            const timeout = view.getBigUint64(sub + 24, true);
            const precision = view.getBigUint64(sub + 32, true);
            const flags = view.getUint16(sub + 40, true);
            subscriptions[i] = {
              userdata,
              type,
              u: {
                clock: {
                  clock_id: clockIdOrFd,
                  timeout,
                  precision,
                  flags
                },
                fd_readwrite: {
                  fd: clockIdOrFd
                }
              }
            };
          }
          const fdevents = [];
          for (i = 0; i < nsubscriptions; i++) {
            sub = subscriptions[i];
            switch (sub.type) {
              case 0: {
                if (sub.u.clock.flags === 1) {
                  const now = BigInt(Date.now()) * BigInt(1e6);
                  cur_timeout = sub.u.clock.timeout - now;
                } else {
                  cur_timeout = sub.u.clock.timeout;
                }
                if (has_timeout === 0 || cur_timeout < min_timeout) {
                  min_timeout = cur_timeout;
                  timer_userdata = sub.userdata;
                  has_timeout = 1;
                }
                break;
              }
              case 1:
              case 2:
                fdevents.push(sub);
                break;
              default:
                return 28;
            }
          }
          if (fdevents.length > 0) {
            for (i = 0; i < fdevents.length; i++) {
              const fdevent = fdevents[i];
              const event = out_ptr + 32 * i;
              view.setBigUint64(event, fdevent.userdata, true);
              view.setUint32(event + 8, 52, true);
              view.setUint32(event + 12, fdevent.type, true);
              view.setBigUint64(event + 16, BigInt(0), true);
              view.setUint16(event + 24, 0, true);
              view.setUint32(nevents, 1, true);
            }
            view.setUint32(nevents, fdevents.length, true);
            return 0;
          }
          if (has_timeout) {
            const delay = Number(min_timeout / BigInt(1e6));
            sleepBreakIf(delay, () => false);
            const event = out_ptr;
            view.setBigUint64(event, timer_userdata, true);
            view.setUint32(event + 8, 0, true);
            view.setUint32(event + 12, 0, true);
            view.setUint32(nevents, 1, true);
          }
          return 0;
        });
        this.proc_exit = syscallWrap(this, "proc_exit", function(rval) {
          if (typeof process === "object" && process !== null && typeof process.exit === "function") {
            process.exit(rval);
          }
          return 0;
        });
        this.proc_raise = syscallWrap(this, "proc_raise", function(_sig) {
          return 52;
        });
        this.sched_yield = syscallWrap(this, "sched_yield", function() {
          return 0;
        });
        this.random_get = typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function" ? syscallWrap(this, "random_get", function(buf, buf_len) {
          buf = Number(buf);
          if (buf === 0) {
            return 28;
          }
          buf_len = Number(buf_len);
          const { HEAPU8, view } = getMemory(this);
          if (typeof SharedArrayBuffer === "function" && HEAPU8.buffer instanceof SharedArrayBuffer || Object.prototype.toString.call(HEAPU8.buffer) === "[object SharedArrayBuffer]") {
            for (let i = buf; i < buf + buf_len; ++i) {
              view.setUint8(i, Math.floor(Math.random() * 256));
            }
            return 0;
          }
          let pos;
          const stride = 65536;
          for (pos = 0; pos + stride < buf_len; pos += stride) {
            crypto.getRandomValues(HEAPU8.subarray(buf + pos, buf + pos + stride));
          }
          crypto.getRandomValues(HEAPU8.subarray(buf + pos, buf + buf_len));
          return 0;
        }) : syscallWrap(this, "random_get", function(buf, buf_len) {
          buf = Number(buf);
          if (buf === 0) {
            return 28;
          }
          buf_len = Number(buf_len);
          const { view } = getMemory(this);
          for (let i = buf; i < buf + buf_len; ++i) {
            view.setUint8(i, Math.floor(Math.random() * 256));
          }
          return 0;
        });
        this.sock_recv = syscallWrap(this, "sock_recv", function() {
          return 58;
        });
        this.sock_send = syscallWrap(this, "sock_send", function() {
          return 58;
        });
        this.sock_shutdown = syscallWrap(this, "sock_shutdown", function() {
          return 58;
        });
        this.sock_accept = syscallWrap(this, "sock_accept", function() {
          return 58;
        });
        _wasi.set(this, {
          fds,
          args,
          env
        });
        if (fs2)
          _fs.set(this, fs2);
        const _this = this;
        function defineImport(name, syncVersion, asyncVersion, parameterType, returnType) {
          if (asyncFs) {
            if (asyncify) {
              _this[name] = asyncify.wrapImportFunction(syscallWrap(_this, name, asyncVersion));
            } else {
              _this[name] = wrapAsyncImport(syscallWrap(_this, name, asyncVersion), parameterType, returnType);
            }
          } else {
            _this[name] = syscallWrap(_this, name, syncVersion);
          }
        }
        defineImport("fd_allocate", function fd_allocate(fd, offset, len) {
          const wasi2 = _wasi.get(this);
          const fs3 = getFs(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.FD_ALLOCATE, BigInt(0));
          const stat = fs3.fstatSync(fileDescriptor.fd, { bigint: true });
          if (stat.size < offset + len) {
            fs3.ftruncateSync(fileDescriptor.fd, Number(offset + len));
          }
          return 0;
        }, async function fd_allocate(fd, offset, len) {
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.FD_ALLOCATE, BigInt(0));
          const h = fileDescriptor.fd;
          const stat = await h.stat({ bigint: true });
          if (stat.size < offset + len) {
            await h.truncate(Number(offset + len));
          }
          return 0;
        }, ["i32", "i64", "f64"], ["i32"]);
        defineImport("fd_close", function fd_close(fd) {
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, BigInt(0), BigInt(0));
          const fs3 = getFs(this);
          fs3.closeSync(fileDescriptor.fd);
          wasi2.fds.remove(fd);
          return 0;
        }, async function fd_close(fd) {
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, BigInt(0), BigInt(0));
          await fileDescriptor.fd.close();
          wasi2.fds.remove(fd);
          return 0;
        }, ["i32"], ["i32"]);
        defineImport("fd_datasync", function fd_datasync(fd) {
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.FD_DATASYNC, BigInt(0));
          const fs3 = getFs(this);
          fs3.fdatasyncSync(fileDescriptor.fd);
          return 0;
        }, async function fd_datasync(fd) {
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.FD_DATASYNC, BigInt(0));
          await fileDescriptor.fd.datasync();
          return 0;
        }, ["i32"], ["i32"]);
        defineImport("fd_filestat_get", function fd_filestat_get(fd, buf) {
          buf = Number(buf);
          if (buf === 0)
            return 28;
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.FD_FILESTAT_GET, BigInt(0));
          const fs3 = getFs(this);
          const stat = fs3.fstatSync(fileDescriptor.fd, { bigint: true });
          const { view } = getMemory(this);
          toFileStat(view, buf, stat);
          return 0;
        }, async function fd_filestat_get(fd, buf) {
          buf = Number(buf);
          if (buf === 0)
            return 28;
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.FD_FILESTAT_GET, BigInt(0));
          const h = fileDescriptor.fd;
          const stat = await h.stat({ bigint: true });
          const { view } = getMemory(this);
          toFileStat(view, buf, stat);
          return 0;
        }, ["i32", "i32"], ["i32"]);
        defineImport("fd_filestat_set_size", function fd_filestat_set_size(fd, size) {
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.FD_FILESTAT_SET_SIZE, BigInt(0));
          const fs3 = getFs(this);
          fs3.ftruncateSync(fileDescriptor.fd, Number(size));
          return 0;
        }, async function fd_filestat_set_size(fd, size) {
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.FD_FILESTAT_SET_SIZE, BigInt(0));
          const h = fileDescriptor.fd;
          await h.truncate(Number(size));
          return 0;
        }, ["i32", "i64"], ["i32"]);
        function fdFilestatGetTimes(fd, atim, mtim, flags) {
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.FD_FILESTAT_SET_TIMES, BigInt(0));
          if ((flags & 2) === 2) {
            atim = BigInt(Date.now() * 1e6);
          }
          if ((flags & 8) === 8) {
            mtim = BigInt(Date.now() * 1e6);
          }
          return { fileDescriptor, atim, mtim };
        }
        defineImport("fd_filestat_set_times", function fd_filestat_set_times(fd, atim, mtim, flags) {
          if (validateFstFlagsOrReturn(flags)) {
            return 28;
          }
          const { fileDescriptor, atim: atimRes, mtim: mtimRes } = fdFilestatGetTimes.call(this, fd, atim, mtim, flags);
          const fs3 = getFs(this);
          fs3.futimesSync(fileDescriptor.fd, Number(atimRes), Number(mtimRes));
          return 0;
        }, async function fd_filestat_set_times(fd, atim, mtim, flags) {
          if (validateFstFlagsOrReturn(flags)) {
            return 28;
          }
          const { fileDescriptor, atim: atimRes, mtim: mtimRes } = fdFilestatGetTimes.call(this, fd, atim, mtim, flags);
          const h = fileDescriptor.fd;
          await h.utimes(Number(atimRes), Number(mtimRes));
          return 0;
        }, ["i32", "i64", "i64", "i32"], ["i32"]);
        defineImport("fd_pread", function fd_pread(fd, iovs, iovslen, offset, size) {
          iovs = Number(iovs);
          size = Number(size);
          if (iovs === 0 && iovslen || size === 0 || offset > INT64_MAX) {
            return 28;
          }
          const { HEAPU8, view } = getMemory(this);
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.FD_READ | WasiRights.FD_SEEK, BigInt(0));
          if (!iovslen) {
            view.setUint32(size, 0, true);
            return 0;
          }
          let totalSize = 0;
          const ioVecs = Array.from({ length: Number(iovslen) }, (_, i) => {
            const offset2 = iovs + i * 8;
            const buf = view.getInt32(offset2, true);
            const bufLen = view.getUint32(offset2 + 4, true);
            totalSize += bufLen;
            return HEAPU8.subarray(buf, buf + bufLen);
          });
          let nread = 0;
          const buffer = (() => {
            try {
              return new Uint8Array(new SharedArrayBuffer(totalSize));
            } catch (_) {
              return new Uint8Array(totalSize);
            }
          })();
          buffer._isBuffer = true;
          const fs3 = getFs(this);
          const bytesRead = fs3.readSync(fileDescriptor.fd, buffer, 0, buffer.length, Number(offset));
          nread = buffer ? copyMemory(ioVecs, buffer.subarray(0, bytesRead)) : 0;
          view.setUint32(size, nread, true);
          return 0;
        }, async function(fd, iovs, iovslen, offset, size) {
          iovs = Number(iovs);
          size = Number(size);
          if (iovs === 0 && iovslen || size === 0 || offset > INT64_MAX) {
            return 28;
          }
          const { HEAPU8, view } = getMemory(this);
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.FD_READ | WasiRights.FD_SEEK, BigInt(0));
          if (!iovslen) {
            view.setUint32(size, 0, true);
            return 0;
          }
          let totalSize = 0;
          const ioVecs = Array.from({ length: Number(iovslen) }, (_, i) => {
            const offset2 = iovs + i * 8;
            const buf = view.getInt32(offset2, true);
            const bufLen = view.getUint32(offset2 + 4, true);
            totalSize += bufLen;
            return HEAPU8.subarray(buf, buf + bufLen);
          });
          let nread = 0;
          const buffer = new Uint8Array(totalSize);
          buffer._isBuffer = true;
          const { bytesRead } = await fileDescriptor.fd.read(buffer, 0, buffer.length, Number(offset));
          nread = buffer ? copyMemory(ioVecs, buffer.subarray(0, bytesRead)) : 0;
          view.setUint32(size, nread, true);
          return 0;
        }, ["i32", "i32", "i32", "i64", "i32"], ["i32"]);
        defineImport("fd_pwrite", function fd_pwrite(fd, iovs, iovslen, offset, size) {
          iovs = Number(iovs);
          size = Number(size);
          if (iovs === 0 && iovslen || size === 0 || offset > INT64_MAX) {
            return 28;
          }
          const { HEAPU8, view } = getMemory(this);
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.FD_WRITE | WasiRights.FD_SEEK, BigInt(0));
          if (!iovslen) {
            view.setUint32(size, 0, true);
            return 0;
          }
          const buffer = concatBuffer(Array.from({ length: Number(iovslen) }, (_, i) => {
            const offset2 = iovs + i * 8;
            const buf = view.getInt32(offset2, true);
            const bufLen = view.getUint32(offset2 + 4, true);
            return HEAPU8.subarray(buf, buf + bufLen);
          }));
          const fs3 = getFs(this);
          const nwritten = fs3.writeSync(fileDescriptor.fd, buffer, 0, buffer.length, Number(offset));
          view.setUint32(size, nwritten, true);
          return 0;
        }, async function fd_pwrite(fd, iovs, iovslen, offset, size) {
          iovs = Number(iovs);
          size = Number(size);
          if (iovs === 0 && iovslen || size === 0 || offset > INT64_MAX) {
            return 28;
          }
          const { HEAPU8, view } = getMemory(this);
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.FD_WRITE | WasiRights.FD_SEEK, BigInt(0));
          if (!iovslen) {
            view.setUint32(size, 0, true);
            return 0;
          }
          const buffer = concatBuffer(Array.from({ length: Number(iovslen) }, (_, i) => {
            const offset2 = iovs + i * 8;
            const buf = view.getInt32(offset2, true);
            const bufLen = view.getUint32(offset2 + 4, true);
            return HEAPU8.subarray(buf, buf + bufLen);
          }));
          const { bytesWritten } = await fileDescriptor.fd.write(buffer, 0, buffer.length, Number(offset));
          view.setUint32(size, bytesWritten, true);
          return 0;
        }, ["i32", "i32", "i32", "i64", "i32"], ["i32"]);
        defineImport("fd_read", function fd_read(fd, iovs, iovslen, size) {
          iovs = Number(iovs);
          size = Number(size);
          if (iovs === 0 && iovslen || size === 0) {
            return 28;
          }
          const { HEAPU8, view } = getMemory(this);
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.FD_READ, BigInt(0));
          if (!iovslen) {
            view.setUint32(size, 0, true);
            return 0;
          }
          let totalSize = 0;
          const ioVecs = Array.from({ length: Number(iovslen) }, (_, i) => {
            const offset = iovs + i * 8;
            const buf = view.getInt32(offset, true);
            const bufLen = view.getUint32(offset + 4, true);
            totalSize += bufLen;
            return HEAPU8.subarray(buf, buf + bufLen);
          });
          let buffer;
          let nread = 0;
          if (fd === 0) {
            if (typeof window === "undefined" || typeof window.prompt !== "function") {
              return 58;
            }
            buffer = readStdin();
            nread = buffer ? copyMemory(ioVecs, buffer) : 0;
          } else {
            buffer = (() => {
              try {
                return new Uint8Array(new SharedArrayBuffer(totalSize));
              } catch (_) {
                return new Uint8Array(totalSize);
              }
            })();
            buffer._isBuffer = true;
            const fs3 = getFs(this);
            const bytesRead = fs3.readSync(fileDescriptor.fd, buffer, 0, buffer.length, Number(fileDescriptor.pos));
            nread = buffer ? copyMemory(ioVecs, buffer.subarray(0, bytesRead)) : 0;
            fileDescriptor.pos += BigInt(nread);
          }
          view.setUint32(size, nread, true);
          return 0;
        }, async function fd_read(fd, iovs, iovslen, size) {
          iovs = Number(iovs);
          size = Number(size);
          if (iovs === 0 && iovslen || size === 0) {
            return 28;
          }
          const { HEAPU8, view } = getMemory(this);
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.FD_READ, BigInt(0));
          if (!iovslen) {
            view.setUint32(size, 0, true);
            return 0;
          }
          let totalSize = 0;
          const ioVecs = Array.from({ length: Number(iovslen) }, (_, i) => {
            const offset = iovs + i * 8;
            const buf = view.getInt32(offset, true);
            const bufLen = view.getUint32(offset + 4, true);
            totalSize += bufLen;
            return HEAPU8.subarray(buf, buf + bufLen);
          });
          let buffer;
          let nread = 0;
          if (fd === 0) {
            if (typeof window === "undefined" || typeof window.prompt !== "function") {
              return 58;
            }
            buffer = readStdin();
            nread = buffer ? copyMemory(ioVecs, buffer) : 0;
          } else {
            buffer = new Uint8Array(totalSize);
            buffer._isBuffer = true;
            const { bytesRead } = await fileDescriptor.fd.read(buffer, 0, buffer.length, Number(fileDescriptor.pos));
            nread = buffer ? copyMemory(ioVecs, buffer.subarray(0, bytesRead)) : 0;
            fileDescriptor.pos += BigInt(nread);
          }
          view.setUint32(size, nread, true);
          return 0;
        }, ["i32", "i32", "i32", "i32"], ["i32"]);
        defineImport("fd_readdir", function fd_readdir(fd, buf, buf_len, cookie, bufused) {
          buf = Number(buf);
          buf_len = Number(buf_len);
          bufused = Number(bufused);
          if (buf === 0 || bufused === 0)
            return 0;
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.FD_READDIR, BigInt(0));
          const fs3 = getFs(this);
          const entries = fs3.readdirSync(fileDescriptor.realPath, { withFileTypes: true });
          const { HEAPU8, view } = getMemory(this);
          let bufferUsed = 0;
          for (let i = Number(cookie); i < entries.length; i++) {
            const nameData = encoder.encode(entries[i].name);
            const entryInfo = fs3.statSync(resolve(fileDescriptor.realPath, entries[i].name), { bigint: true });
            const entryData = new Uint8Array(24 + nameData.byteLength);
            const entryView = new DataView(entryData.buffer);
            entryView.setBigUint64(0, BigInt(i + 1), true);
            entryView.setBigUint64(8, BigInt(entryInfo.ino ? entryInfo.ino : 0), true);
            entryView.setUint32(16, nameData.byteLength, true);
            let type;
            if (entries[i].isFile()) {
              type = 4;
            } else if (entries[i].isDirectory()) {
              type = 3;
            } else if (entries[i].isSymbolicLink()) {
              type = 7;
            } else if (entries[i].isCharacterDevice()) {
              type = 2;
            } else if (entries[i].isBlockDevice()) {
              type = 1;
            } else if (entries[i].isSocket()) {
              type = 6;
            } else {
              type = 0;
            }
            entryView.setUint8(20, type);
            entryData.set(nameData, 24);
            const data = entryData.slice(0, Math.min(entryData.length, buf_len - bufferUsed));
            HEAPU8.set(data, buf + bufferUsed);
            bufferUsed += data.byteLength;
          }
          view.setUint32(bufused, bufferUsed, true);
          return 0;
        }, async function fd_readdir(fd, buf, buf_len, cookie, bufused) {
          buf = Number(buf);
          buf_len = Number(buf_len);
          bufused = Number(bufused);
          if (buf === 0 || bufused === 0)
            return 0;
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.FD_READDIR, BigInt(0));
          const fs3 = getFs(this);
          const entries = await fs3.promises.readdir(fileDescriptor.realPath, { withFileTypes: true });
          const { HEAPU8, view } = getMemory(this);
          let bufferUsed = 0;
          for (let i = Number(cookie); i < entries.length; i++) {
            const nameData = encoder.encode(entries[i].name);
            const entryInfo = await fs3.promises.stat(resolve(fileDescriptor.realPath, entries[i].name), { bigint: true });
            const entryData = new Uint8Array(24 + nameData.byteLength);
            const entryView = new DataView(entryData.buffer);
            entryView.setBigUint64(0, BigInt(i + 1), true);
            entryView.setBigUint64(8, BigInt(entryInfo.ino ? entryInfo.ino : 0), true);
            entryView.setUint32(16, nameData.byteLength, true);
            let type;
            if (entries[i].isFile()) {
              type = 4;
            } else if (entries[i].isDirectory()) {
              type = 3;
            } else if (entries[i].isSymbolicLink()) {
              type = 7;
            } else if (entries[i].isCharacterDevice()) {
              type = 2;
            } else if (entries[i].isBlockDevice()) {
              type = 1;
            } else if (entries[i].isSocket()) {
              type = 6;
            } else {
              type = 0;
            }
            entryView.setUint8(20, type);
            entryData.set(nameData, 24);
            const data = entryData.slice(0, Math.min(entryData.length, buf_len - bufferUsed));
            HEAPU8.set(data, buf + bufferUsed);
            bufferUsed += data.byteLength;
          }
          view.setUint32(bufused, bufferUsed, true);
          return 0;
        }, ["i32", "i32", "i32", "i64", "i32"], ["i32"]);
        defineImport("fd_renumber", function fd_renumber(from, to) {
          const wasi2 = _wasi.get(this);
          wasi2.fds.renumber(to, from);
          return 0;
        }, async function fd_renumber(from, to) {
          const wasi2 = _wasi.get(this);
          await wasi2.fds.renumber(to, from);
          return 0;
        }, ["i32", "i32"], ["i32"]);
        defineImport("fd_sync", function fd_sync(fd) {
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.FD_SYNC, BigInt(0));
          const fs3 = getFs(this);
          fs3.fsyncSync(fileDescriptor.fd);
          return 0;
        }, async function fd_sync(fd) {
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.FD_SYNC, BigInt(0));
          await fileDescriptor.fd.sync();
          return 0;
        }, ["i32"], ["i32"]);
        defineImport("fd_write", function fd_write(fd, iovs, iovslen, size) {
          iovs = Number(iovs);
          size = Number(size);
          if (iovs === 0 && iovslen || size === 0) {
            return 28;
          }
          const { HEAPU8, view } = getMemory(this);
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.FD_WRITE, BigInt(0));
          if (!iovslen) {
            view.setUint32(size, 0, true);
            return 0;
          }
          const buffer = concatBuffer(Array.from({ length: Number(iovslen) }, (_, i) => {
            const offset = iovs + i * 8;
            const buf = view.getInt32(offset, true);
            const bufLen = view.getUint32(offset + 4, true);
            return HEAPU8.subarray(buf, buf + bufLen);
          }));
          let nwritten;
          if (fd === 1 || fd === 2) {
            nwritten = fileDescriptor.write(buffer);
          } else {
            const fs3 = getFs(this);
            nwritten = fs3.writeSync(fileDescriptor.fd, buffer, 0, buffer.length, Number(fileDescriptor.pos));
            fileDescriptor.pos += BigInt(nwritten);
          }
          view.setUint32(size, nwritten, true);
          return 0;
        }, async function fd_write(fd, iovs, iovslen, size) {
          iovs = Number(iovs);
          size = Number(size);
          if (iovs === 0 && iovslen || size === 0) {
            return 28;
          }
          const { HEAPU8, view } = getMemory(this);
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.FD_WRITE, BigInt(0));
          if (!iovslen) {
            view.setUint32(size, 0, true);
            return 0;
          }
          const buffer = concatBuffer(Array.from({ length: Number(iovslen) }, (_, i) => {
            const offset = iovs + i * 8;
            const buf = view.getInt32(offset, true);
            const bufLen = view.getUint32(offset + 4, true);
            return HEAPU8.subarray(buf, buf + bufLen);
          }));
          let nwritten;
          if (fd === 1 || fd === 2) {
            nwritten = fileDescriptor.write(buffer);
          } else {
            nwritten = await (await fileDescriptor.fd.write(buffer, 0, buffer.length, Number(fileDescriptor.pos))).bytesWritten;
            fileDescriptor.pos += BigInt(nwritten);
          }
          view.setUint32(size, nwritten, true);
          return 0;
        }, ["i32", "i32", "i32", "i32"], ["i32"]);
        defineImport("path_create_directory", function path_create_directory(fd, path, path_len) {
          path = Number(path);
          path_len = Number(path_len);
          if (path === 0) {
            return 28;
          }
          const { HEAPU8 } = getMemory(this);
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.PATH_CREATE_DIRECTORY, BigInt(0));
          let pathString = decoder.decode(unsharedSlice(HEAPU8, path, path + path_len));
          pathString = resolve(fileDescriptor.realPath, pathString);
          const fs3 = getFs(this);
          fs3.mkdirSync(pathString);
          return 0;
        }, async function path_create_directory(fd, path, path_len) {
          path = Number(path);
          path_len = Number(path_len);
          if (path === 0) {
            return 28;
          }
          const { HEAPU8 } = getMemory(this);
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.PATH_CREATE_DIRECTORY, BigInt(0));
          let pathString = decoder.decode(unsharedSlice(HEAPU8, path, path + path_len));
          pathString = resolve(fileDescriptor.realPath, pathString);
          const fs3 = getFs(this);
          await fs3.promises.mkdir(pathString);
          return 0;
        }, ["i32", "i32", "i32"], ["i32"]);
        defineImport("path_filestat_get", function path_filestat_get(fd, flags, path, path_len, filestat) {
          path = Number(path);
          path_len = Number(path_len);
          filestat = Number(filestat);
          if (path === 0 || filestat === 0) {
            return 28;
          }
          const { HEAPU8, view } = getMemory(this);
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.PATH_FILESTAT_GET, BigInt(0));
          let pathString = decoder.decode(unsharedSlice(HEAPU8, path, path + path_len));
          const fs3 = getFs(this);
          pathString = resolve(fileDescriptor.realPath, pathString);
          let stat;
          if ((flags & 1) === 1) {
            stat = fs3.statSync(pathString, { bigint: true });
          } else {
            stat = fs3.lstatSync(pathString, { bigint: true });
          }
          toFileStat(view, filestat, stat);
          return 0;
        }, async function path_filestat_get(fd, flags, path, path_len, filestat) {
          path = Number(path);
          path_len = Number(path_len);
          filestat = Number(filestat);
          if (path === 0 || filestat === 0) {
            return 28;
          }
          const { HEAPU8, view } = getMemory(this);
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.PATH_FILESTAT_GET, BigInt(0));
          let pathString = decoder.decode(unsharedSlice(HEAPU8, path, path + path_len));
          const fs3 = getFs(this);
          pathString = resolve(fileDescriptor.realPath, pathString);
          let stat;
          if ((flags & 1) === 1) {
            stat = await fs3.promises.stat(pathString, { bigint: true });
          } else {
            stat = await fs3.promises.lstat(pathString, { bigint: true });
          }
          toFileStat(view, filestat, stat);
          return 0;
        }, ["i32", "i32", "i32", "i32", "i32"], ["i32"]);
        defineImport("path_filestat_set_times", function path_filestat_set_times(fd, flags, path, path_len, atim, mtim, fst_flags) {
          path = Number(path);
          path_len = Number(path_len);
          if (path === 0)
            return 28;
          const { HEAPU8 } = getMemory(this);
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.PATH_FILESTAT_SET_TIMES, BigInt(0));
          if (validateFstFlagsOrReturn(fst_flags)) {
            return 28;
          }
          const fs3 = getFs(this);
          const resolvedPath = resolvePathSync(fs3, fileDescriptor, decoder.decode(unsharedSlice(HEAPU8, path, path + path_len)), flags);
          if ((fst_flags & 2) === 2) {
            atim = BigInt(Date.now() * 1e6);
          }
          if ((fst_flags & 8) === 8) {
            mtim = BigInt(Date.now() * 1e6);
          }
          fs3.utimesSync(resolvedPath, Number(atim), Number(mtim));
          return 0;
        }, async function path_filestat_set_times(fd, flags, path, path_len, atim, mtim, fst_flags) {
          path = Number(path);
          path_len = Number(path_len);
          if (path === 0)
            return 28;
          const { HEAPU8 } = getMemory(this);
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.PATH_FILESTAT_SET_TIMES, BigInt(0));
          if (validateFstFlagsOrReturn(fst_flags)) {
            return 28;
          }
          const fs3 = getFs(this);
          const resolvedPath = await resolvePathAsync(fs3, fileDescriptor, decoder.decode(unsharedSlice(HEAPU8, path, path + path_len)), flags);
          if ((fst_flags & 2) === 2) {
            atim = BigInt(Date.now() * 1e6);
          }
          if ((fst_flags & 8) === 8) {
            mtim = BigInt(Date.now() * 1e6);
          }
          await fs3.promises.utimes(resolvedPath, Number(atim), Number(mtim));
          return 0;
        }, ["i32", "i32", "i32", "i32", "i64", "i64", "i32"], ["i32"]);
        defineImport("path_link", function path_link(old_fd, old_flags, old_path, old_path_len, new_fd, new_path, new_path_len) {
          old_path = Number(old_path);
          old_path_len = Number(old_path_len);
          new_path = Number(new_path);
          new_path_len = Number(new_path_len);
          if (old_path === 0 || new_path === 0) {
            return 28;
          }
          const wasi2 = _wasi.get(this);
          let oldWrap;
          let newWrap;
          if (old_fd === new_fd) {
            oldWrap = newWrap = wasi2.fds.get(old_fd, WasiRights.PATH_LINK_SOURCE | WasiRights.PATH_LINK_TARGET, BigInt(0));
          } else {
            oldWrap = wasi2.fds.get(old_fd, WasiRights.PATH_LINK_SOURCE, BigInt(0));
            newWrap = wasi2.fds.get(new_fd, WasiRights.PATH_LINK_TARGET, BigInt(0));
          }
          const { HEAPU8 } = getMemory(this);
          const fs3 = getFs(this);
          const resolvedOldPath = resolvePathSync(fs3, oldWrap, decoder.decode(unsharedSlice(HEAPU8, old_path, old_path + old_path_len)), old_flags);
          const resolvedNewPath = resolve(newWrap.realPath, decoder.decode(unsharedSlice(HEAPU8, new_path, new_path + new_path_len)));
          fs3.linkSync(resolvedOldPath, resolvedNewPath);
          return 0;
        }, async function path_link(old_fd, old_flags, old_path, old_path_len, new_fd, new_path, new_path_len) {
          old_path = Number(old_path);
          old_path_len = Number(old_path_len);
          new_path = Number(new_path);
          new_path_len = Number(new_path_len);
          if (old_path === 0 || new_path === 0) {
            return 28;
          }
          const wasi2 = _wasi.get(this);
          let oldWrap;
          let newWrap;
          if (old_fd === new_fd) {
            oldWrap = newWrap = wasi2.fds.get(old_fd, WasiRights.PATH_LINK_SOURCE | WasiRights.PATH_LINK_TARGET, BigInt(0));
          } else {
            oldWrap = wasi2.fds.get(old_fd, WasiRights.PATH_LINK_SOURCE, BigInt(0));
            newWrap = wasi2.fds.get(new_fd, WasiRights.PATH_LINK_TARGET, BigInt(0));
          }
          const { HEAPU8 } = getMemory(this);
          const fs3 = getFs(this);
          const resolvedOldPath = await resolvePathAsync(fs3, oldWrap, decoder.decode(unsharedSlice(HEAPU8, old_path, old_path + old_path_len)), old_flags);
          const resolvedNewPath = resolve(newWrap.realPath, decoder.decode(unsharedSlice(HEAPU8, new_path, new_path + new_path_len)));
          await fs3.promises.link(resolvedOldPath, resolvedNewPath);
          return 0;
        }, ["i32", "i32", "i32", "i32", "i32", "i32", "i32"], ["i32"]);
        function pathOpen(o_flags, fs_rights_base, fs_rights_inheriting, fs_flags) {
          const read = (fs_rights_base & (WasiRights.FD_READ | WasiRights.FD_READDIR)) !== BigInt(0);
          const write = (fs_rights_base & (WasiRights.FD_DATASYNC | WasiRights.FD_WRITE | WasiRights.FD_ALLOCATE | WasiRights.FD_FILESTAT_SET_SIZE)) !== BigInt(0);
          let flags = write ? read ? 2 : 1 : 0;
          let needed_base = WasiRights.PATH_OPEN;
          let needed_inheriting = fs_rights_base | fs_rights_inheriting;
          if ((o_flags & 1) !== 0) {
            flags |= 64;
            needed_base |= WasiRights.PATH_CREATE_FILE;
          }
          if ((o_flags & 2) !== 0) {
            flags |= 65536;
          }
          if ((o_flags & 4) !== 0) {
            flags |= 128;
          }
          if ((o_flags & 8) !== 0) {
            flags |= 512;
            needed_base |= WasiRights.PATH_FILESTAT_SET_SIZE;
          }
          if ((fs_flags & 1) !== 0) {
            flags |= 1024;
          }
          if ((fs_flags & 2) !== 0) {
            needed_inheriting |= WasiRights.FD_DATASYNC;
          }
          if ((fs_flags & 4) !== 0) {
            flags |= 2048;
          }
          if ((fs_flags & 8) !== 0) {
            flags |= 1052672;
            needed_inheriting |= WasiRights.FD_SYNC;
          }
          if ((fs_flags & 16) !== 0) {
            flags |= 1052672;
            needed_inheriting |= WasiRights.FD_SYNC;
          }
          if (write && (flags & (1024 | 512)) === 0) {
            needed_inheriting |= WasiRights.FD_SEEK;
          }
          return { flags, needed_base, needed_inheriting };
        }
        defineImport("path_open", function path_open(dirfd, dirflags, path, path_len, o_flags, fs_rights_base, fs_rights_inheriting, fs_flags, fd) {
          path = Number(path);
          fd = Number(fd);
          if (path === 0 || fd === 0) {
            return 28;
          }
          path_len = Number(path_len);
          fs_rights_base = BigInt(fs_rights_base);
          fs_rights_inheriting = BigInt(fs_rights_inheriting);
          const { flags: flagsRes, needed_base: neededBase, needed_inheriting: neededInheriting } = pathOpen(o_flags, fs_rights_base, fs_rights_inheriting, fs_flags);
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(dirfd, neededBase, neededInheriting);
          const memory = getMemory(this);
          const HEAPU8 = memory.HEAPU8;
          const pathString = decoder.decode(unsharedSlice(HEAPU8, path, path + path_len));
          const fs3 = getFs(this);
          const resolved_path = resolvePathSync(fs3, fileDescriptor, pathString, dirflags);
          const r = fs3.openSync(resolved_path, flagsRes, 438);
          const filetype = wasi2.fds.getFileTypeByFd(r);
          if ((o_flags & 2) !== 0 && filetype !== 3) {
            return 54;
          }
          const { base: max_base, inheriting: max_inheriting } = getRights(wasi2.fds.stdio, r, flagsRes, filetype);
          const wrap = wasi2.fds.insert(r, resolved_path, resolved_path, filetype, fs_rights_base & max_base, fs_rights_inheriting & max_inheriting, 0);
          const stat = fs3.fstatSync(r, { bigint: true });
          if (stat.isFile()) {
            wrap.size = stat.size;
            if ((flagsRes & 1024) !== 0) {
              wrap.pos = stat.size;
            }
          }
          const view = memory.view;
          view.setInt32(fd, wrap.id, true);
          return 0;
        }, async function path_open(dirfd, dirflags, path, path_len, o_flags, fs_rights_base, fs_rights_inheriting, fs_flags, fd) {
          path = Number(path);
          fd = Number(fd);
          if (path === 0 || fd === 0) {
            return 28;
          }
          path_len = Number(path_len);
          fs_rights_base = BigInt(fs_rights_base);
          fs_rights_inheriting = BigInt(fs_rights_inheriting);
          const { flags: flagsRes, needed_base: neededBase, needed_inheriting: neededInheriting } = pathOpen(o_flags, fs_rights_base, fs_rights_inheriting, fs_flags);
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(dirfd, neededBase, neededInheriting);
          const memory = getMemory(this);
          const HEAPU8 = memory.HEAPU8;
          const pathString = decoder.decode(unsharedSlice(HEAPU8, path, path + path_len));
          const fs3 = getFs(this);
          const resolved_path = await resolvePathAsync(fs3, fileDescriptor, pathString, dirflags);
          const r = await fs3.promises.open(resolved_path, flagsRes, 438);
          const filetype = await wasi2.fds.getFileTypeByFd(r);
          if ((o_flags & 2) !== 0 && filetype !== 3) {
            return 54;
          }
          const { base: max_base, inheriting: max_inheriting } = getRights(wasi2.fds.stdio, r.fd, flagsRes, filetype);
          const wrap = wasi2.fds.insert(r, resolved_path, resolved_path, filetype, fs_rights_base & max_base, fs_rights_inheriting & max_inheriting, 0);
          const stat = await r.stat({ bigint: true });
          if (stat.isFile()) {
            wrap.size = stat.size;
            if ((flagsRes & 1024) !== 0) {
              wrap.pos = stat.size;
            }
          }
          const view = memory.view;
          view.setInt32(fd, wrap.id, true);
          return 0;
        }, ["i32", "i32", "i32", "i32", "i32", "i64", "i64", "i32", "i32"], ["i32"]);
        defineImport("path_readlink", function path_readlink(fd, path, path_len, buf, buf_len, bufused) {
          path = Number(path);
          path_len = Number(path_len);
          buf = Number(buf);
          buf_len = Number(buf_len);
          bufused = Number(bufused);
          if (path === 0 || buf === 0 || bufused === 0) {
            return 28;
          }
          const { HEAPU8, view } = getMemory(this);
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.PATH_READLINK, BigInt(0));
          let pathString = decoder.decode(unsharedSlice(HEAPU8, path, path + path_len));
          pathString = resolve(fileDescriptor.realPath, pathString);
          const fs3 = getFs(this);
          const link = fs3.readlinkSync(pathString);
          const linkData = encoder.encode(link);
          const len = Math.min(linkData.length, buf_len);
          if (len >= buf_len)
            return 42;
          HEAPU8.set(linkData.subarray(0, len), buf);
          HEAPU8[buf + len] = 0;
          view.setUint32(bufused, len, true);
          return 0;
        }, async function path_readlink(fd, path, path_len, buf, buf_len, bufused) {
          path = Number(path);
          path_len = Number(path_len);
          buf = Number(buf);
          buf_len = Number(buf_len);
          bufused = Number(bufused);
          if (path === 0 || buf === 0 || bufused === 0) {
            return 28;
          }
          const { HEAPU8, view } = getMemory(this);
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.PATH_READLINK, BigInt(0));
          let pathString = decoder.decode(unsharedSlice(HEAPU8, path, path + path_len));
          pathString = resolve(fileDescriptor.realPath, pathString);
          const fs3 = getFs(this);
          const link = await fs3.promises.readlink(pathString);
          const linkData = encoder.encode(link);
          const len = Math.min(linkData.length, buf_len);
          if (len >= buf_len)
            return 42;
          HEAPU8.set(linkData.subarray(0, len), buf);
          HEAPU8[buf + len] = 0;
          view.setUint32(bufused, len, true);
          return 0;
        }, ["i32", "i32", "i32", "i32", "i32", "i32"], ["i32"]);
        defineImport("path_remove_directory", function path_remove_directory(fd, path, path_len) {
          path = Number(path);
          path_len = Number(path_len);
          if (path === 0) {
            return 28;
          }
          const { HEAPU8 } = getMemory(this);
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.PATH_REMOVE_DIRECTORY, BigInt(0));
          let pathString = decoder.decode(unsharedSlice(HEAPU8, path, path + path_len));
          pathString = resolve(fileDescriptor.realPath, pathString);
          const fs3 = getFs(this);
          fs3.rmdirSync(pathString);
          return 0;
        }, async function path_remove_directory(fd, path, path_len) {
          path = Number(path);
          path_len = Number(path_len);
          if (path === 0) {
            return 28;
          }
          const { HEAPU8 } = getMemory(this);
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.PATH_REMOVE_DIRECTORY, BigInt(0));
          let pathString = decoder.decode(unsharedSlice(HEAPU8, path, path + path_len));
          pathString = resolve(fileDescriptor.realPath, pathString);
          const fs3 = getFs(this);
          await fs3.promises.rmdir(pathString);
          return 0;
        }, ["i32", "i32", "i32"], ["i32"]);
        defineImport("path_rename", function path_rename(old_fd, old_path, old_path_len, new_fd, new_path, new_path_len) {
          old_path = Number(old_path);
          old_path_len = Number(old_path_len);
          new_path = Number(new_path);
          new_path_len = Number(new_path_len);
          if (old_path === 0 || new_path === 0) {
            return 28;
          }
          const wasi2 = _wasi.get(this);
          let oldWrap;
          let newWrap;
          if (old_fd === new_fd) {
            oldWrap = newWrap = wasi2.fds.get(old_fd, WasiRights.PATH_RENAME_SOURCE | WasiRights.PATH_RENAME_TARGET, BigInt(0));
          } else {
            oldWrap = wasi2.fds.get(old_fd, WasiRights.PATH_RENAME_SOURCE, BigInt(0));
            newWrap = wasi2.fds.get(new_fd, WasiRights.PATH_RENAME_TARGET, BigInt(0));
          }
          const { HEAPU8 } = getMemory(this);
          const resolvedOldPath = resolve(oldWrap.realPath, decoder.decode(unsharedSlice(HEAPU8, old_path, old_path + old_path_len)));
          const resolvedNewPath = resolve(newWrap.realPath, decoder.decode(unsharedSlice(HEAPU8, new_path, new_path + new_path_len)));
          const fs3 = getFs(this);
          fs3.renameSync(resolvedOldPath, resolvedNewPath);
          return 0;
        }, async function path_rename(old_fd, old_path, old_path_len, new_fd, new_path, new_path_len) {
          old_path = Number(old_path);
          old_path_len = Number(old_path_len);
          new_path = Number(new_path);
          new_path_len = Number(new_path_len);
          if (old_path === 0 || new_path === 0) {
            return 28;
          }
          const wasi2 = _wasi.get(this);
          let oldWrap;
          let newWrap;
          if (old_fd === new_fd) {
            oldWrap = newWrap = wasi2.fds.get(old_fd, WasiRights.PATH_RENAME_SOURCE | WasiRights.PATH_RENAME_TARGET, BigInt(0));
          } else {
            oldWrap = wasi2.fds.get(old_fd, WasiRights.PATH_RENAME_SOURCE, BigInt(0));
            newWrap = wasi2.fds.get(new_fd, WasiRights.PATH_RENAME_TARGET, BigInt(0));
          }
          const { HEAPU8 } = getMemory(this);
          const resolvedOldPath = resolve(oldWrap.realPath, decoder.decode(unsharedSlice(HEAPU8, old_path, old_path + old_path_len)));
          const resolvedNewPath = resolve(newWrap.realPath, decoder.decode(unsharedSlice(HEAPU8, new_path, new_path + new_path_len)));
          const fs3 = getFs(this);
          await fs3.promises.rename(resolvedOldPath, resolvedNewPath);
          return 0;
        }, ["i32", "i32", "i32", "i32", "i32", "i32"], ["i32"]);
        defineImport("path_symlink", function path_symlink(old_path, old_path_len, fd, new_path, new_path_len) {
          old_path = Number(old_path);
          old_path_len = Number(old_path_len);
          new_path = Number(new_path);
          new_path_len = Number(new_path_len);
          if (old_path === 0 || new_path === 0) {
            return 28;
          }
          const { HEAPU8 } = getMemory(this);
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.PATH_SYMLINK, BigInt(0));
          const oldPath = decoder.decode(unsharedSlice(HEAPU8, old_path, old_path + old_path_len));
          let newPath = decoder.decode(unsharedSlice(HEAPU8, new_path, new_path + new_path_len));
          newPath = resolve(fileDescriptor.realPath, newPath);
          const fs3 = getFs(this);
          fs3.symlinkSync(oldPath, newPath);
          return 0;
        }, async function path_symlink(old_path, old_path_len, fd, new_path, new_path_len) {
          old_path = Number(old_path);
          old_path_len = Number(old_path_len);
          new_path = Number(new_path);
          new_path_len = Number(new_path_len);
          if (old_path === 0 || new_path === 0) {
            return 28;
          }
          const { HEAPU8 } = getMemory(this);
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.PATH_SYMLINK, BigInt(0));
          const oldPath = decoder.decode(unsharedSlice(HEAPU8, old_path, old_path + old_path_len));
          let newPath = decoder.decode(unsharedSlice(HEAPU8, new_path, new_path + new_path_len));
          newPath = resolve(fileDescriptor.realPath, newPath);
          const fs3 = getFs(this);
          await fs3.promises.symlink(oldPath, newPath);
          return 0;
        }, ["i32", "i32", "i32", "i32", "i32"], ["i32"]);
        defineImport("path_unlink_file", function path_unlink_file(fd, path, path_len) {
          path = Number(path);
          path_len = Number(path_len);
          if (path === 0) {
            return 28;
          }
          const { HEAPU8 } = getMemory(this);
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.PATH_UNLINK_FILE, BigInt(0));
          let pathString = decoder.decode(unsharedSlice(HEAPU8, path, path + path_len));
          pathString = resolve(fileDescriptor.realPath, pathString);
          const fs3 = getFs(this);
          fs3.unlinkSync(pathString);
          return 0;
        }, async function path_unlink_file(fd, path, path_len) {
          path = Number(path);
          path_len = Number(path_len);
          if (path === 0) {
            return 28;
          }
          const { HEAPU8 } = getMemory(this);
          const wasi2 = _wasi.get(this);
          const fileDescriptor = wasi2.fds.get(fd, WasiRights.PATH_UNLINK_FILE, BigInt(0));
          let pathString = decoder.decode(unsharedSlice(HEAPU8, path, path + path_len));
          pathString = resolve(fileDescriptor.realPath, pathString);
          const fs3 = getFs(this);
          await fs3.promises.unlink(pathString);
          return 0;
        }, ["i32", "i32", "i32"], ["i32"]);
        this._setMemory = function setMemory(m) {
          if (!(m instanceof _WebAssembly.Memory)) {
            throw new TypeError('"instance.exports.memory" property must be a WebAssembly.Memory');
          }
          _memory.set(_this, extendMemory(m));
        };
      }
      static createSync(args, env, preopens, stdio, fs2, print, printErr) {
        const fds = new SyncTable({
          size: 3,
          in: stdio[0],
          out: stdio[1],
          err: stdio[2],
          fs: fs2,
          print,
          printErr
        });
        const _this = new _WASI$1(args, env, fds, false, fs2);
        if (preopens.length > 0) {
          for (let i = 0; i < preopens.length; ++i) {
            const realPath = fs2.realpathSync(preopens[i].realPath, "utf8");
            const fd = fs2.openSync(realPath, "r", 438);
            fds.insertPreopen(fd, preopens[i].mappedPath, realPath);
          }
        }
        return _this;
      }
      static async createAsync(args, env, preopens, stdio, fs2, print, printErr, asyncify) {
        const fds = new AsyncTable({
          size: 3,
          in: stdio[0],
          out: stdio[1],
          err: stdio[2],
          print,
          printErr
        });
        const _this = new _WASI$1(args, env, fds, true, fs2, asyncify);
        if (preopens.length > 0) {
          for (let i = 0; i < preopens.length; ++i) {
            const entry = preopens[i];
            const realPath = await fs2.promises.realpath(entry.realPath);
            const fd = await fs2.promises.open(realPath, "r", 438);
            await fds.insertPreopen(fd, entry.mappedPath, realPath);
          }
        }
        return _this;
      }
    };
    kEmptyObject = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.create(null));
    kExitCode = Symbol("kExitCode");
    kSetMemory = Symbol("kSetMemory");
    kStarted = Symbol("kStarted");
    kInstance = Symbol("kInstance");
    kBindingName = Symbol("kBindingName");
    WASI = class {
      constructor(options = kEmptyObject) {
        const { args, env, preopens, stdio, _WASI: _WASI2 } = validateOptions.call(this, options);
        const wrap = _WASI2.createSync(args, env, preopens, stdio, options.fs, options.print, options.printErr);
        const setMemory = wrap._setMemory;
        delete wrap._setMemory;
        initWASI.call(this, setMemory, wrap);
        if (options.returnOnExit) {
          wrap.proc_exit = wasiReturnOnProcExit.bind(this);
        }
      }
      // Must not export _initialize, must export _start
      start(instance) {
        if (this[kStarted]) {
          throw new Error("WASI instance has already started");
        }
        this[kStarted] = true;
        setupInstance(this, instance);
        const { _start, _initialize } = this[kInstance].exports;
        validateFunction(_start, "instance.exports._start");
        validateUndefined(_initialize, "instance.exports._initialize");
        let ret;
        try {
          ret = _start();
        } catch (err) {
          if (err !== kExitCode) {
            throw err;
          }
        }
        if (ret instanceof Promise) {
          return ret.then(() => this[kExitCode], (err) => {
            if (err !== kExitCode) {
              throw err;
            }
            return this[kExitCode];
          });
        }
        return this[kExitCode];
      }
      // Must not export _start, may optionally export _initialize
      initialize(instance) {
        if (this[kStarted]) {
          throw new Error("WASI instance has already started");
        }
        this[kStarted] = true;
        setupInstance(this, instance);
        const { _start, _initialize } = this[kInstance].exports;
        validateUndefined(_start, "instance.exports._start");
        if (_initialize !== void 0) {
          validateFunction(_initialize, "instance.exports._initialize");
          return _initialize();
        }
      }
      getImportObject() {
        return { [this[kBindingName]]: this.wasiImport };
      }
    };
  }
});

// node_modules/.pnpm/@bokuweb+reg-cli-wasm@0.0.0-experimental0/node_modules/@bokuweb/reg-cli-wasm/dist/shared/reg-cli-wasm.96c141f0.cjs
var require_reg_cli_wasm_96c141f0 = __commonJS({
  "node_modules/.pnpm/@bokuweb+reg-cli-wasm@0.0.0-experimental0/node_modules/@bokuweb/reg-cli-wasm/dist/shared/reg-cli-wasm.96c141f0.cjs"(exports2) {
    "use strict";
    var path = require("path");
    var url = require("url");
    var promises = require("node:fs/promises");
    var node_path = require("node:path");
    var _documentCurrentScript = typeof document !== "undefined" ? document.currentScript : null;
    function _interopDefaultCompat2(e) {
      return e && typeof e === "object" && "default" in e ? e.default : e;
    }
    var path__default = /* @__PURE__ */ _interopDefaultCompat2(path);
    var isCJS = typeof __dirname !== "undefined";
    var readWasm = () => {
      const dir = isCJS ? __dirname : path__default.dirname(url.fileURLToPath(typeof document === "undefined" ? require("url").pathToFileURL(__filename).href : _documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === "SCRIPT" && _documentCurrentScript.src || new URL("shared/reg-cli-wasm.96c141f0.cjs", document.baseURI).href));
      const file2 = promises.readFile(node_path.join(dir, "./reg.wasm"));
      return file2;
    };
    var resolveExtention = () => {
      return isCJS ? "cjs" : "mjs";
    };
    exports2.isCJS = isCJS;
    exports2.readWasm = readWasm;
    exports2.resolveExtention = resolveExtention;
  }
});

// node_modules/.pnpm/@bokuweb+reg-cli-wasm@0.0.0-experimental0/node_modules/@bokuweb/reg-cli-wasm/dist/worker.cjs
var node_worker_threads = require("node:worker_threads");
var fs = require("node:fs");
var wasmUtil = (init_wasm_util_esm_bundler(), __toCommonJS(wasm_util_esm_bundler_exports));
var node_process = require("node:process");
var utils = require_reg_cli_wasm_96c141f0();
require("path");
require("url");
require("node:fs/promises");
require("node:path");
function _interopDefaultCompat(e) {
  return e && typeof e === "object" && "default" in e ? e.default : e;
}
var fs__default = /* @__PURE__ */ _interopDefaultCompat(fs);
var kIsProxy = Symbol("kIsProxy");
var createInstanceProxy = (instance, memory) => {
  if (instance[kIsProxy])
    return instance;
  const originalExports = instance.exports;
  const createHandler = function(target) {
    const handlers = [
      "apply",
      "construct",
      "defineProperty",
      "deleteProperty",
      "get",
      "getOwnPropertyDescriptor",
      "getPrototypeOf",
      "has",
      "isExtensible",
      "ownKeys",
      "preventExtensions",
      "set",
      "setPrototypeOf"
    ];
    const handler22 = {};
    for (let i = 0; i < handlers.length; i++) {
      const name = handlers[i];
      handler22[name] = function() {
        const args = Array.prototype.slice.call(arguments, 1);
        args.unshift(target);
        return Reflect[name].apply(Reflect, args);
      };
    }
    return handler22;
  };
  const handler2 = createHandler(originalExports);
  const _initialize = () => {
  };
  const _start = () => 0;
  handler2.get = function(_target, p, receiver) {
    if (p === "memory") {
      return (typeof memory === "function" ? memory() : memory) ?? Reflect.get(originalExports, p, receiver);
    }
    if (p === "_initialize") {
      return p in originalExports ? _initialize : void 0;
    }
    if (p === "_start") {
      return p in originalExports ? _start : void 0;
    }
    return Reflect.get(originalExports, p, receiver);
  };
  handler2.has = function(_target, p) {
    if (p === "memory")
      return true;
    return Reflect.has(originalExports, p);
  };
  const exportsProxy = new Proxy(/* @__PURE__ */ Object.create(null), handler2);
  return new Proxy(instance, {
    get(target, p, receiver) {
      if (p === "exports") {
        return exportsProxy;
      }
      if (p === kIsProxy) {
        return true;
      }
      return Reflect.get(target, p, receiver);
    }
  });
};
console.log(node_worker_threads.workerData.argv, "arg");
var wasi = new wasmUtil.WASI({
  version: "preview1",
  args: node_worker_threads.workerData.argv,
  env: node_process.env,
  returnOnExit: true,
  preopens: { "./": "./" },
  fs: fs__default
});
var imports = wasi.getImportObject();
var file = utils.readWasm();
var handler = async ({ startArg, tid, memory }) => {
  try {
    const wasm = await WebAssembly.compile(await file);
    let instance = await WebAssembly.instantiate(wasm, {
      ...imports,
      wasi: {
        "thread-spawn": (startArg2) => {
          const threadIdBuffer = new SharedArrayBuffer(4);
          const id = new Int32Array(threadIdBuffer);
          Atomics.store(id, 0, -1);
          postMessage({ cmd: "thread-spawn", startArg: startArg2, threadId: id, memory });
          Atomics.wait(id, 0, -1);
          const tid2 = Atomics.load(id, 0);
          return tid2;
        }
      },
      env: { memory }
    });
    instance = createInstanceProxy(instance, memory);
    wasi.start(instance);
    instance.exports.wasi_thread_start(tid, startArg);
  } catch (e) {
    throw e;
  }
};
node_worker_threads.parentPort?.addListener("message", handler);
