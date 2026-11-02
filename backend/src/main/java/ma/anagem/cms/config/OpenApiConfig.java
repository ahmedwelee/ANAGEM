package ma.anagem.cms.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {
    @Bean
    OpenAPI openApi() {
        return new OpenAPI()
                .info(new Info().title("ANAGEM CMS API").version("0.1.0")
                        .description("Public read API (/api/public), authentication (/api/auth) and admin API (/api/admin, Bearer JWT). Content is multilingual: pass ?lang=fr|ar|en or Accept-Language."))
                .components(new Components().addSecuritySchemes("bearerAuth", new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList("bearerAuth"));
    }

    @Bean GroupedOpenApi publicApi() { return GroupedOpenApi.builder().group("1-public").pathsToMatch("/api/public/**").build(); }
    @Bean GroupedOpenApi authApi() { return GroupedOpenApi.builder().group("2-auth").pathsToMatch("/api/auth/**").build(); }
    @Bean GroupedOpenApi adminApi() { return GroupedOpenApi.builder().group("3-admin").pathsToMatch("/api/admin/**").build(); }
}
