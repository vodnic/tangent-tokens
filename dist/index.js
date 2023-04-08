"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const log4js_1 = __importDefault(require("log4js"));
const app = (0, express_1.default)();
log4js_1.default.configure('log4js.json');
const logger = log4js_1.default.getLogger('index.ts');
app.get('/ping', (req, res) => {
    logger.debug('Received ping request');
    res.send('pong');
});
app.listen(3000, () => {
    logger.info('Server is listening on port 3000');
});
//# sourceMappingURL=index.js.map