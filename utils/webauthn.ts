
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
    pubKeyCredParams: [{ alg: -7, type: "public-key" }], // ES256
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      userVerification: "required",
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

export const authenticateFingerprint = async (credentialId: string): Promise<boolean> => {
  if (!window.PublicKeyCredential) {
    throw new Error("WebAuthn n'est pas supporté par ce navigateur.");
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const idBuffer = Uint8Array.from(atob(credentialId), c => c.charCodeAt(0));

  const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
    challenge,
    allowCredentials: [
      {
        id: idBuffer,
        type: "public-key",
        transports: ["internal"],
      },
    ],
    userVerification: "required",
    timeout: 60000,
  };

  const assertion = (await navigator.credentials.get({
    publicKey: publicKeyCredentialRequestOptions,
  })) as PublicKeyCredential;

  return !!assertion;
};
