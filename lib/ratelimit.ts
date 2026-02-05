type RateLimitStore = Map<string, { count: number; lastReset: number }>;

const rateLimitMap: RateLimitStore = new Map();

export function rateLimit(ip: string, limit: number = 5, windowMs: number = 10000) {
    const now = Date.now();
    const record = rateLimitMap.get(ip);

    if (!record) {
        rateLimitMap.set(ip, { count: 1, lastReset: now });
        return { success: true };
    }

    if (now - record.lastReset > windowMs) {
        record.count = 1;
        record.lastReset = now;
        return { success: true };
    }

    if (record.count >= limit) {
        return { success: false };
    }

    record.count += 1;
    return { success: true };
}

// Optional: Cleanup interval (not strictly necessary for small memory, but good practice)
if (process.env.NODE_ENV !== 'test') {
    setInterval(() => {
        const now = Date.now();
        for (const [key, value] of rateLimitMap.entries()) {
            if (now - value.lastReset > 60000) { // Cleanup after 1 min
                rateLimitMap.delete(key);
            }
        }
    }, 60000); // Run every minute
}
