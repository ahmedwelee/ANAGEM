package ma.anagem.cms.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import ma.anagem.cms.exception.ApiError;
import ma.anagem.cms.security.JwtAuthFilter;
import ma.anagem.cms.security.RateLimitFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {
    private final JwtAuthFilter jwtFilter;
    private final RateLimitFilter rateLimitFilter;
    private final AppProperties props;
    private final ObjectMapper mapper;

    @Bean
    PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(12); }

    @Bean
    SecurityFilterChain chain(HttpSecurity http) throws Exception {
        http.csrf(AbstractHttpConfigurer::disable) // stateless Bearer-token API: no cookies, nothing for CSRF to ride on
            .cors(c -> c.configurationSource(corsSource()))
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .headers(h -> h.contentSecurityPolicy(c -> c.policyDirectives("default-src 'none'; frame-ancestors 'none'"))
                           .frameOptions(f -> f.disable()))
            .authorizeHttpRequests(a -> a
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers("/api/public/**", "/api/auth/login", "/actuator/health/**", "/actuator/info").permitAll()
                .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                .requestMatchers("/api/admin/**", "/api/auth/**").authenticated()
                .anyRequest().denyAll())
            .exceptionHandling(e -> e
                .authenticationEntryPoint((req, res, ex) -> write(res, 401, "UNAUTHENTICATED", "Authentication required", req.getRequestURI()))
                .accessDeniedHandler((req, res, ex) -> write(res, 403, "ACCESS_DENIED", "You do not have permission to perform this action", req.getRequestURI())))
            .addFilterBefore(rateLimitFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    private void write(jakarta.servlet.http.HttpServletResponse res, int status, String code, String msg, String path) throws java.io.IOException {
        res.setStatus(status);
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        mapper.writeValue(res.getWriter(), new ApiError(Instant.now(), status, code, msg, path, null));
    }

    private CorsConfigurationSource corsSource() {
        CorsConfiguration c = new CorsConfiguration();
        c.setAllowedOrigins(props.cors().allowedOrigins());
        c.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        c.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "Accept-Language"));
        c.setExposedHeaders(List.of("Content-Disposition"));
        c.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource s = new UrlBasedCorsConfigurationSource();
        s.registerCorsConfiguration("/**", c);
        return s;
    }
}
