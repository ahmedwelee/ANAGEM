package ma.anagem.cms.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import ma.anagem.cms.config.AppProperties;
import ma.anagem.cms.exception.ApiError;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Sliding-window limiter per client IP for the sensitive public endpoints (login, contact form). In-memory: one instance only. */
@Component
@RequiredArgsConstructor
public class RateLimitFilter extends OncePerRequestFilter {
    private static final long WINDOW_MS = 60_000;
    private final AppProperties props;
    private final ObjectMapper mapper;
    private final Map<String, Deque<Long>> hits = new ConcurrentHashMap<>();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest r) { return limitFor(r) == 0; }

    private int limitFor(HttpServletRequest r) {
        if (!"POST".equals(r.getMethod())) return 0;
        String p = r.getRequestURI();
        if (p.equals("/api/auth/login")) return props.rateLimit().loginPerMinute();
        if (p.equals("/api/public/contact")) return props.rateLimit().contactPerMinute();
        return 0;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
        long now = System.currentTimeMillis();
        String key = req.getRequestURI() + "|" + req.getRemoteAddr();
        Deque<Long> q = hits.computeIfAbsent(key, k -> new ArrayDeque<>());
        boolean allowed;
        synchronized (q) {
            while (!q.isEmpty() && now - q.peekFirst() > WINDOW_MS) q.pollFirst();
            allowed = q.size() < limitFor(req);
            if (allowed) q.addLast(now);
        }
        if (allowed) { chain.doFilter(req, res); return; }
        res.setStatus(429);
        res.setHeader("Retry-After", "60");
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        mapper.writeValue(res.getWriter(), new ApiError(Instant.now(), 429, "RATE_LIMITED", "Too many requests, please try again later", req.getRequestURI(), null));
    }

    @Scheduled(fixedDelay = 300_000)
    void evict() {
        long now = System.currentTimeMillis();
        hits.entrySet().removeIf(e -> { synchronized (e.getValue()) { return e.getValue().isEmpty() || now - e.getValue().peekLast() > WINDOW_MS; } });
    }
}
