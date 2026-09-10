import { createHash, createPublicKey, timingSafeEqual, verify } from 'node:crypto';

import { plaidRequest } from './plaid';

type VerificationKeyResponse = {
  key: {
    alg: string;
    crv: string;
    kid: string;
    kty: string;
    use?: string;
    x: string;
    y: string;
    created_at: number;
    expired_at: number | null;
  };
};

type JwtHeader = {
  alg?: string;
  kid?: string;
};

type JwtPayload = {
  iat?: number;
  request_body_sha256?: string;
};

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

export async function verifyPlaidWebhook(rawBody: Buffer, verificationJwt: string): Promise<void> {
  const parts = verificationJwt.split('.');
  if (parts.length !== 3) throw new Error('Invalid Plaid verification JWT');

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = JSON.parse(decodeBase64Url(encodedHeader).toString('utf8')) as JwtHeader;
  if (header.alg !== 'ES256' || !header.kid) throw new Error('Invalid Plaid verification header');

  const { key } = await plaidRequest<VerificationKeyResponse>('/webhook_verification_key/get', {
    key_id: header.kid,
  });

  if (key.alg !== 'ES256' || key.kid !== header.kid || key.kty !== 'EC' || key.crv !== 'P-256') {
    throw new Error('Invalid Plaid verification key');
  }
  if (key.expired_at !== null && key.expired_at <= Math.floor(Date.now() / 1000)) {
    throw new Error('Expired Plaid verification key');
  }

  const publicKey = createPublicKey({
    key: {
      kty: key.kty,
      crv: key.crv,
      x: key.x,
      y: key.y,
    },
    format: 'jwk',
  });

  const signingInput = Buffer.from(`${encodedHeader}.${encodedPayload}`);
  const signature = decodeBase64Url(encodedSignature);
  const signatureValid = verify(
    'sha256',
    signingInput,
    { key: publicKey, dsaEncoding: 'ieee-p1363' },
    signature,
  );
  if (!signatureValid) throw new Error('Invalid Plaid webhook signature');

  const payload = JSON.parse(decodeBase64Url(encodedPayload).toString('utf8')) as JwtPayload;
  if (!payload.iat || Math.abs(Math.floor(Date.now() / 1000) - payload.iat) > 300) {
    throw new Error('Stale Plaid webhook');
  }
  if (!payload.request_body_sha256) throw new Error('Missing Plaid webhook body hash');

  const actualHash = createHash('sha256').update(rawBody).digest('hex');
  const expected = Buffer.from(payload.request_body_sha256, 'hex');
  const actual = Buffer.from(actualHash, 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error('Plaid webhook body hash mismatch');
  }
}
