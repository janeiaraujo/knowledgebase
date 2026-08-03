/**
 * Armazenamento de arquivos: Cloudflare R2 como destino principal, disco
 * local apenas como fallback quando o R2 nao esta configurado ou falha.
 *
 * A logica de R2 vivia duplicada dentro de files.routes.js; centralizada aqui
 * para que outros modulos (ex.: avatar do usuario) reusem em vez de copiar.
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
 * Grava o arquivo no R2 quando configurado; cai para o disco local apenas
 * se o R2 nao estiver configurado ou se o envio falhar.
 *
 * Nao mantem copia local quando o R2 responde: o disco local e fallback,
 * nao replica. Isso evita ocupar disco do servidor com arquivos que ja
 * estao no object storage.
 *
 * @returns {{ url: string, key: string, storage: 'r2'|'local' }}
 */
export const storeFile = async ({
    tenantId, fileName, buffer, contentType, metadata, logger
}) => {
    const tenantIdStr = String(tenantId);
    const key = `${tenantIdStr}/${fileName}`;

    if (hasR2Config()) {
        try {
            const r2Url = await uploadToR2(key, buffer, contentType, metadata);
            return { url: r2Url, key, storage: 'r2' };
        } catch (error) {
            // Fallback: nao perde o upload por indisponibilidade do R2
            logger?.warn?.({ err: error }, 'Falha ao enviar para o R2; gravando no disco local');
        }
    }

    return {
        url: saveLocalCopy(tenantIdStr, fileName, buffer),
        key,
        storage: 'local'
    };
};
