"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionFromToken = void 0;
/**
 * Returns a connect middleware function which exchanges a token for a session
 */
const sessionFromToken = ({ getTokenFromRequest, getLookupFromToken, findUserByLookup, createSession, callNextWithError, }) => async (req, res, next) => {
    try {
        const token = await getTokenFromRequest(req);
        if (!token) {
            return next();
        }
        const email = await getLookupFromToken(token);
        if (!email) {
            return next();
        }
        const user = await findUserByLookup(email);
        if (!user) {
            return next();
        }
        await createSession(req, res, user);
        next();
    }
    catch (err) {
        if (callNextWithError) {
            next(err);
        }
        else {
            next();
        }
    }
};
exports.sessionFromToken = sessionFromToken;
