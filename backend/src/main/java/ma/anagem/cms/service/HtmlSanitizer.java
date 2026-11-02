package ma.anagem.cms.service;

import org.owasp.html.HtmlPolicyBuilder;
import org.owasp.html.PolicyFactory;
import org.springframework.stereotype.Component;

/** Allow-list sanitizer for editor HTML. Scripts, styles, event handlers, iframes and javascript: URLs are always stripped. */
@Component
public class HtmlSanitizer {
    private static final PolicyFactory POLICY = new HtmlPolicyBuilder()
            .allowElements("p", "br", "hr", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s", "sub", "sup", "blockquote", "q",
                    "ul", "ol", "li", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "figure", "figcaption", "code", "pre", "span", "div", "a", "img")
            .allowAttributes("dir", "lang").onElements("p", "h2", "h3", "h4", "blockquote", "ul", "ol", "li", "table", "td", "th", "div", "span")
            .allowAttributes("colspan", "rowspan").onElements("td", "th")
            .allowAttributes("href").matching((el, attr, v) -> safeUrl(v)).onElements("a")
            .allowAttributes("target").matching(true, "_blank", "_self").onElements("a")
            .allowAttributes("src").matching((el, attr, v) -> safeUrl(v)).onElements("img")
            .allowAttributes("alt", "title").onElements("img", "a")
            .allowAttributes("width", "height").matching(java.util.regex.Pattern.compile("\\d{1,4}")).onElements("img")
            .allowUrlProtocols("http", "https", "mailto", "tel")
            .requireRelsOnLinks("noopener", "noreferrer")
            .toFactory();

    private static String safeUrl(String url) {
        if (url == null) return null;
        String u = url.strip();
        if (u.startsWith("/api/public/media/") || u.startsWith("#")) return u;
        String lower = u.toLowerCase();
        return (lower.startsWith("https://") || lower.startsWith("http://") || lower.startsWith("mailto:") || lower.startsWith("tel:")) ? u : null;
    }

    public String clean(String html) { return html == null || html.isBlank() ? null : POLICY.sanitize(html); }

}
