package ma.anagem.cms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;

class MediaIntegrationTest extends IntegrationTestBase {
    String editor, admin;

    @BeforeEach
    void tokens() throws Exception { editor = tokenFor("EDITOR"); admin = tokenFor("ADMIN"); }

    static byte[] png(int w, int h) throws Exception {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        for (int x = 0; x < w; x += 7) for (int y = 0; y < h; y += 7) img.setRGB(x, y, (x * 31 + y * 17) & 0xFFFFFF);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "png", out);
        return out.toByteArray();
    }

    static byte[] pdf() { return "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF".getBytes(StandardCharsets.US_ASCII); }

    JsonNode upload(String token, String name, String type, byte[] data, int expected) throws Exception {
        String res = mvc.perform(bearer(multipart("/api/admin/media/upload").file(new MockMultipartFile("file", name, type, data)), token))
                .andExpect(status().is(expected)).andReturn().getResponse().getContentAsString();
        return json.readTree(res);
    }

    @Test
    void imagesAreValidatedDownsizedAndGetAThumbnail() throws Exception {
        JsonNode m = upload(editor, "big.png", "image/png", png(3000, 2000), 201);
        assertThat(m.path("kind").asText()).isEqualTo("IMAGE");
        assertThat(m.path("width").asInt()).isEqualTo(2400);
        assertThat(m.path("height").asInt()).isEqualTo(1600);
        assertThat(m.path("url").asText()).startsWith("/api/public/media/");   // never a filesystem path
        assertThat(m.toString()).doesNotContain("storage").doesNotContain("/tmp");

        byte[] full = mvc.perform(get(m.path("url").asText())).andExpect(status().isOk()).andExpect(content().contentType("image/png"))
                .andExpect(header().exists("ETag")).andReturn().getResponse().getContentAsByteArray();
        assertThat(ImageIO.read(new ByteArrayInputStream(full)).getWidth()).isEqualTo(2400);
        byte[] thumb = mvc.perform(get(m.path("thumbnailUrl").asText())).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        assertThat(ImageIO.read(new ByteArrayInputStream(thumb)).getWidth()).isEqualTo(480);
    }

    @Test
    void pdfsAreAcceptedAndServedInlineOrAsDownload() throws Exception {
        JsonNode m = upload(editor, "Revue 12.pdf", "application/pdf", pdf(), 201);
        assertThat(m.path("kind").asText()).isEqualTo("PDF");
        mvc.perform(get(m.path("url").asText())).andExpect(status().isOk()).andExpect(content().contentType("application/pdf"))
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.startsWith("inline")));
        mvc.perform(get(m.path("url").asText()).param("download", "true")).andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.startsWith("attachment")));
    }

    @Test
    void disguisedOrDangerousFilesAreRejected() throws Exception {
        upload(editor, "evil.png", "image/png", "just some text".getBytes(StandardCharsets.UTF_8), 415);
        upload(editor, "page.pdf", "application/pdf", "<html><script>alert(1)</script></html>".getBytes(StandardCharsets.UTF_8), 415);
        upload(editor, "logo.svg", "image/svg+xml", "<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'/>".getBytes(StandardCharsets.UTF_8), 415);
        upload(editor, "run.exe", "application/octet-stream", new byte[]{'M', 'Z', 0, 0}, 415);
        upload(editor, "empty.png", "image/png", new byte[0], 400);
        byte[] corrupt = new byte[2000];
        System.arraycopy(new byte[]{(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A}, 0, corrupt, 0, 8);
        assertThat(upload(editor, "broken.png", "image/png", corrupt, 400).path("code").asText()).isEqualTo("INVALID_IMAGE");
    }

    @Test
    void oversizedImagesAreRefused() throws Exception {
        byte[] big = new byte[9 * 1024 * 1024];
        big[0] = (byte) 0xFF; big[1] = (byte) 0xD8; big[2] = (byte) 0xFF;
        assertThat(upload(editor, "huge.jpg", "image/jpeg", big, 413).path("code").asText()).isEqualTo("FILE_TOO_LARGE");
    }

    @Test
    void originalFilenamesAreSanitized() throws Exception {
        JsonNode m = upload(editor, "../../etc/pass<script>wd.png", "image/png", png(40, 40), 201);
        assertThat(m.path("originalName").asText()).doesNotContain("/").doesNotContain("<").doesNotContain("..");
    }

    @Test
    void uploadAndDeletePermissionsAreEnforced() throws Exception {
        mvc.perform(multipart("/api/admin/media/upload").file(new MockMultipartFile("file", "a.png", "image/png", png(20, 20)))).andExpect(status().isUnauthorized());
        JsonNode m = upload(editor, "a.png", "image/png", png(20, 20), 201);
        String id = m.path("id").asText();
        mvc.perform(bearer(delete("/api/admin/media/" + id), editor)).andExpect(status().isForbidden());
        mvc.perform(bearer(delete("/api/admin/media/" + id), admin)).andExpect(status().isNoContent());
        mvc.perform(get("/api/public/media/" + id)).andExpect(status().isNotFound());
    }

    @Test
    void mediaInUseNeedsForceToDeleteAndAltTextIsLocalized() throws Exception {
        String id = upload(admin, "hero.png", "image/png", png(60, 40), 201).path("id").asText();
        mvc.perform(bearer(put("/api/admin/media/" + id).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("translations", Map.of("fr", Map.of("altText", "Vallée de l'Atlas"), "ar", Map.of("altText", "وادي الأطلس"))))), admin)).andExpect(status().isOk());
        Map<String, Object> body = Map.of("featuredImageId", id, "translations", Map.of("fr", Map.of("title", "Avec image " + id.substring(0, 6)), "ar", Map.of("title", "مع صورة")));
        JsonNode news = json.readTree(mvc.perform(bearer(post("/api/admin/news").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)), admin)).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        long newsId = news.path("id").asLong();
        mvc.perform(bearer(patch("/api/admin/news/" + newsId + "/status").contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"PUBLISHED\"}"), admin)).andExpect(status().isOk());

        mvc.perform(get("/api/public/news/" + news.path("slug").asText()).param("lang", "ar")).andExpect(jsonPath("$.image.altText").value("وادي الأطلس"));
        mvc.perform(get("/api/public/news/" + news.path("slug").asText()).param("lang", "fr")).andExpect(jsonPath("$.image.altText").value("Vallée de l'Atlas"));

        mvc.perform(bearer(delete("/api/admin/media/" + id), admin)).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MEDIA_IN_USE"));
        mvc.perform(bearer(delete("/api/admin/media/" + id).param("force", "true"), admin)).andExpect(status().isNoContent());
        mvc.perform(bearer(get("/api/admin/news/" + newsId), admin)).andExpect(jsonPath("$.featuredImage").doesNotExist());
    }
}
