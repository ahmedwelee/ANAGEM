package ma.anagem.cms.common;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class LocalizedJsonTest {
    private final ObjectMapper mapper = new ObjectMapper();

    private JsonNode resolve(String json, Lang lang) throws Exception { return LocalizedJson.resolve(mapper.readTree(json), lang); }

    @Test
    void picksTheRequestedLanguageAndKeepsSiblingKeys() throws Exception {
        JsonNode out = resolve("{\"order\":3,\"fr\":{\"title\":\"Titre\"},\"ar\":{\"title\":\"عنوان\"}}", Lang.FR);
        assertThat(out.path("title").asText()).isEqualTo("Titre");
        assertThat(out.path("order").asInt()).isEqualTo(3);
        assertThat(out.has("ar")).isFalse();
    }

    @Test
    void mergesTheCommonObjectIntoEveryLanguage() throws Exception {
        String json = "{\"common\":{\"url\":\"/about\"},\"fr\":{\"title\":\"A\"},\"ar\":{\"title\":\"ب\"}}";
        assertThat(resolve(json, Lang.AR).path("url").asText()).isEqualTo("/about");
        assertThat(resolve(json, Lang.AR).path("title").asText()).isEqualTo("ب");
        assertThat(resolve(json, Lang.FR).path("url").asText()).isEqualTo("/about");
        assertThat(resolve(json, Lang.FR).has("common")).isFalse();
    }

    @Test
    void missingOrBlankLanguageFallsBackToArabicThenFrenchThenEnglish() throws Exception {
        assertThat(resolve("{\"fr\":\"Bonjour\",\"ar\":\"مرحبا\"}", Lang.EN).asText()).isEqualTo("مرحبا");
        assertThat(resolve("{\"fr\":\"Bonjour\",\"en\":\"Hello\"}", Lang.AR).asText()).isEqualTo("Bonjour");
        assertThat(resolve("{\"fr\":\"\",\"ar\":\"  \",\"en\":\"Hello\"}", Lang.FR).asText()).isEqualTo("Hello");
        assertThat(resolve("{\"fr\":{},\"en\":\"Hello\"}", Lang.FR).asText()).isEqualTo("Hello");
    }

    @Test
    void nothingUsableBecomesNull() throws Exception {
        assertThat(resolve("{\"fr\":\"\",\"ar\":null}", Lang.AR).isNull()).isTrue();
    }

    @Test
    void walksPlainObjectsAndArrays() throws Exception {
        JsonNode out = resolve("{\"items\":[{\"fr\":{\"t\":\"un\"},\"ar\":{\"t\":\"واحد\"}},{\"fr\":{\"t\":\"deux\"}}],\"count\":2}", Lang.AR);
        assertThat(out.path("count").asInt()).isEqualTo(2);
        assertThat(out.path("items").get(0).path("t").asText()).isEqualTo("واحد");
        assertThat(out.path("items").get(1).path("t").asText()).isEqualTo("deux");
    }

    @Test
    void scalarsAndNullPassThrough() throws Exception {
        assertThat(resolve("42", Lang.FR).asInt()).isEqualTo(42);
        assertThat(LocalizedJson.resolve(null, Lang.FR)).isNull();
    }
}
