const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRY = process.env.JWT_EXPIRY || "24h";

export { JWT_EXPIRY };
export default JWT_SECRET;
