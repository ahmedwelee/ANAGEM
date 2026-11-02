package ma.anagem.cms.security;

import java.time.Instant;

/** Attached to the Authentication so logout can revoke the exact token in use. */
public record TokenDetails(String jti, Instant expiresAt) {}
