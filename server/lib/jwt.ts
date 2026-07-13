const JWT_SECRET = process.env.JWT_SECRET || "prrms-dev-secret-change-in-production";
const JWT_EXPIRY = process.env.JWT_EXPIRY || "24h";

export { JWT_EXPIRY };
export default JWT_SECRET;
