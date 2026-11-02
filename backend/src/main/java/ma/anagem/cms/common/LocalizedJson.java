package ma.anagem.cms.common;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;

/**
 * Resolves CMS JSON to one language. An object holding any of the keys fr/ar/en is a "localized node":
 * the best available language wins (requested, then Arabic, French, English). Sibling keys and an optional "common" object are kept.
 */
public final class LocalizedJson {
    private static final Set<String> LANGS = Set.of("fr", "ar", "en");
    private static final JsonNodeFactory F = JsonNodeFactory.instance;

    private LocalizedJson() {}

    public static JsonNode resolve(JsonNode node, Lang lang) {
        if (node == null || node.isNull()) return node;
        if (node.isArray()) {
            ArrayNode out = F.arrayNode();
            node.forEach(n -> out.add(resolve(n, lang)));
            return out;
        }
        if (!node.isObject()) return node;
        boolean localized = false;
        for (Iterator<String> it = node.fieldNames(); it.hasNext(); ) if (LANGS.contains(it.next())) { localized = true; break; }
        if (!localized) {
            ObjectNode out = F.objectNode();
            node.fields().forEachRemaining(e -> out.set(e.getKey(), resolve(e.getValue(), lang)));
            return out;
        }
        JsonNode picked = null;
        for (String code : new String[]{lang.code(), Lang.DEFAULT.code(), "fr", "en"}) {
            JsonNode c = node.get(code);
            if (c != null && !c.isNull() && !(c.isTextual() && c.asText().isBlank()) && !(c.isObject() && c.isEmpty())) { picked = c; break; }
        }
        if (picked == null) return F.nullNode();
        if (!picked.isObject()) return picked;
        ObjectNode out = F.objectNode();
        for (Map.Entry<String, JsonNode> e : (Iterable<Map.Entry<String, JsonNode>>) node::fields) {
            if (!LANGS.contains(e.getKey()) && !e.getKey().equals("common")) out.set(e.getKey(), resolve(e.getValue(), lang));
        }
        JsonNode common = node.get("common");
        if (common != null && common.isObject()) common.fields().forEachRemaining(e -> out.set(e.getKey(), resolve(e.getValue(), lang)));
        picked.fields().forEachRemaining(e -> out.set(e.getKey(), resolve(e.getValue(), lang)));
        return out;
    }
}
