
export const registerFingerprint = async (username: string): Promise<{ id: string; publicKey: string }> => {
  if (!window.PublicKeyCredential) {
    throw new Error("WebAuthn n'est pas supporté par ce navigateur.");
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const userID = new Uint8Array(16);
  window.crypto.getRandomValues(userID);

  const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
    challenge,
    rp: {
      name: "MicroFoX",
      id: window.location.hostname,
    },
    user: {
      id: userID,
      name: username,
      displayName: username,
    },
    pubKeyCredParams: [
      { alg: -7, type: "public-key" }, // ES256
      { alg: -257, type: "public-key" }, // RS256
      { alg: -8, type: "public-key" } // EdDSA
    ],
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      userVerification: "required",
      residentKey: "required",
      requireResidentKey: true,
    },
    timeout: 60000,
    attestation: "none",
  };

  const credential = (await navigator.credentials.create({
    publicKey: publicKeyCredentialCreationOptions,
  })) as PublicKeyCredential;

  if (!credential) {
    throw new Error("Échec de la création de l'identifiant.");
  }

  const response = credential.response as AuthenticatorAttestationResponse;

  return {
    id: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
    publicKey: btoa(String.fromCharCode(...new Uint8Array(response.getPublicKey()))),
  };
};

export const authenticateFingerprint = async (credentialIds: string | string[]): Promise<string | null> => {
  if (!window.PublicKeyCredential) {
    throw new Error("WebAuthn n'est pas supporté par ce navigateur.");
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const ids = Array.isArray(credentialIds) ? credentialIds : [credentialIds];
  const allowCredentials = ids.map(id => ({
    id: Uint8Array.from(atob(id), c => c.charCodeAt(0)),
    type: "public-key" as const,
    transports: ["internal"] as AuthenticatorTransport[],
  }));

  const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
    challenge,
    allowCredentials,
    userVerification: "required",
    timeout: 60000,
  };

  const assertion = (await navigator.credentials.get({
    publicKey: publicKeyCredentialRequestOptions,
  })) as PublicKeyCredential;

  if (!assertion) return null;

  return btoa(String.fromCharCode(...new Uint8Array(assertion.rawId)));
};
