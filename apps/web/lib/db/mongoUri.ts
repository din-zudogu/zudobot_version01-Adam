/** Parse MongoDB URI with @ or $ in password (split on last @). */
export function parseMongoCredentials(uri: string) {
  const schemeMatch = uri.match(/^(mongodb(?:\+srv)?:\/\/)/);
  if (!schemeMatch) throw new Error("Invalid MongoDB URI");
  const scheme = schemeMatch[1];
  const rest = uri.slice(scheme.length);
  const lastAt = rest.lastIndexOf("@");
  if (lastAt === -1) throw new Error("MongoDB URI missing credentials");
  const credentials = rest.slice(0, lastAt);
  const hostAndMore = rest.slice(lastAt + 1);
  const firstColon = credentials.indexOf(":");
  if (firstColon === -1) throw new Error("MongoDB URI missing password");
  return {
    scheme,
    username: credentials.slice(0, firstColon),
    password: credentials.slice(firstColon + 1),
    hostAndMore,
    uriWithoutCreds: `${scheme}${hostAndMore}`,
  };
}

export function encodeMongoUri(uri: string): string {
  const schemeMatch = uri.match(/^(mongodb(?:\+srv)?:\/\/)/);
  if (!schemeMatch) return uri;
  const scheme = schemeMatch[1];
  const rest = uri.slice(scheme.length);
  const lastAt = rest.lastIndexOf("@");
  if (lastAt === -1) return uri;
  const credentials = rest.slice(0, lastAt);
  const hostAndMore = rest.slice(lastAt + 1);
  const firstColon = credentials.indexOf(":");
  if (firstColon === -1) return uri;
  const user = credentials.slice(0, firstColon);
  const password = credentials.slice(firstColon + 1);
  return `${scheme}${user}:${encodeURIComponent(password)}@${hostAndMore}`;
}
