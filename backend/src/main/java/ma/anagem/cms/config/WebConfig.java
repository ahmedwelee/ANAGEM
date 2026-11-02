package ma.anagem.cms.config;

import java.util.List;
import ma.anagem.cms.common.Lang;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.MethodParameter;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Lets controllers declare a {@code Lang lang} parameter: ?lang=ar overrides Accept-Language; default is French. */
@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(new HandlerMethodArgumentResolver() {
            @Override public boolean supportsParameter(MethodParameter p) { return p.getParameterType() == Lang.class; }
            @Override public Object resolveArgument(MethodParameter p, ModelAndViewContainer m, NativeWebRequest req, WebDataBinderFactory f) {
                return Lang.resolve(req.getParameter("lang"), req.getHeader("Accept-Language"));
            }
        });
    }
}
