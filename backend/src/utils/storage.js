/**
 * Armazenamento de arquivos: Cloudflare R2 com copia local redundante.
 *
 * A logica de R2 vivia duplicada dentro de files.routes.js; centralizada aqui
 * para que outros modulos (ex.: avatar do usuario) reusem em vez de copiar.
 *
 * Diferenca importante entre os dois modos:
 * - `storeFile`      : R2 **ou** disco local (fallback) - comportamento
 *                      historico do upload de arquivos de KB.
 * - `storeFileWithRedundancy`: grava SEMPRE no disco local e, se o R2 estiver
 *                      configurado, tambem envia pra la. Usado no avatar, onde
 *                      queremos a copia local como redundancia mesmo com o R2 ok.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

export const hasR2Config = () => Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME &&
    process.env.R2_PUBLIC_URL
);

export const getR2Client = () => {
    if (!hasR2Config()) return null;
    return new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
        }
    });
};

export const getUploadsDir = () => path.resolve(process.cwd(), 'uploads');

export const getBackendPublicUrl = () =>
    process.env.BACKEND_PUBLIC_URL || 'http://localhost:3000';

/** URL servida pelo proprio backend (GET /api/files/public/:tenantId/:fileName). */
export const buildLocalUrl = (tenantId, fileName) =>
    `${getBackendPublicUrl()}/api/files/public/${tenantId}/${fileName}`;

export const saveLocalCopy = (tenantId, fileName, buffer) => {
    const dir = path.join(getUploadsDir(), String(tenantId));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, fileName), buffer);
    return buildLocalUrl(tenantId, fileName);
};

export const deleteLocalCopy = (tenantId, fileName) => {
    // Normaliza para impedir path traversal via nome de arquivo vindo do banco
    const safeTenant = String(tenantId).replace(/[^a-f0-9]/gi, '');
    const safeFile = path.basename(String(fileName));
    const absolutePath = path.join(getUploadsDir(), safeTenant, safeFile);
    if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
    }
};

export const uploadToR2 = async (key, buffer, contentType, metadata = {}) => {
    const client = getR2Client();
    if (!client) return null;

    await client.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: metadata
    }));

    return `${process.env.R2_PUBLIC_URL}/${key}`;
};

export const deleteFromR2 = async (key) => {
    const client = getR2Client();
    if (!client) return;
    await client.send(new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key
    }));
};

/**
 * Grava no disco local E no R2 (quando configurado).
 *
 * A copia local e escrita primeiro e nunca e descartada: se o R2 cair ou a
 * conta for perdida, o arquivo continua servivel pelo proprio backend. Uma
 * falha no envio ao R2 nao derruba a operacao - degrada para "somente local".
 *
 * @returns {{ url: string, localUrl: string, r2Url: string|null, key: string, storage: string }}
 */
export const storeFileWithRedundancy = async ({
    tenantId, fileName, buffer, contentType, metadata, logger
}) => {
    const tenantIdStr = String(tenantId);
    const key = `${tenantIdStr}/${fileName}`;

    const localUrl = saveLocalCopy(tenantIdStr, fileName, buffer);

    let r2Url = null;
    if (hasR2Config()) {
        try {
            r2Url = await uploadToR2(key, buffer, contentType, metadata);
        } catch (error) {
            // Degrada para somente-local em vez de falhar o upload inteiro
            logger?.warn?.({ err: error }, 'Falha ao enviar para o R2; mantendo apenas a cópia local');
        }
    }

    return {
        url: r2Url || localUrl,
        localUrl,
        r2Url,
        key,
        storage: r2Url ? 'r2+local' : 'local'
    };
};
