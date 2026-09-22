import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { GatewaySignatureService } from './gateway-signature.service';

describe('GatewaySignatureService', () => {
  const secret = '0123456789abcdef0123456789abcdef';

  it('ràng buộc chữ ký với method/path và chặn phát lại', () => {
    const service = new GatewaySignatureService(
      new ConfigService({ TODO_INTERNAL_SECRET: secret }),
    );
    const timestamp = Date.now().toString();
    const context = 'POST:/api/todo';
    const payload = 'encoded-user';
    const requestId = 'request-123';
    const signature = createHmac('sha256', secret)
      .update(`${timestamp}.${requestId}.${payload}.${context}`)
      .digest('hex');
    const headers = { context, payload, requestId, signature, timestamp };

    expect(() => service.assertTrusted(headers)).not.toThrow();
    expect(() => service.assertTrusted(headers)).toThrow('đã được sử dụng');
  });

  it('từ chối payload bị đổi hoặc secret yếu', () => {
    const service = new GatewaySignatureService(
      new ConfigService({ TODO_INTERNAL_SECRET: secret }),
    );
    const timestamp = Date.now().toString();
    const signature = createHmac('sha256', secret)
      .update(`${timestamp}.request-123.encoded-user.GET:/api/todo`)
      .digest('hex');

    expect(() =>
      service.assertTrusted({
        context: 'GET:/api/todo',
        payload: 'forged-user',
        requestId: 'request-123',
        signature,
        timestamp,
      }),
    ).toThrow('Chữ ký Gateway không hợp lệ');
    expect(
      () =>
        new GatewaySignatureService(
          new ConfigService({ TODO_INTERNAL_SECRET: 'short' }),
        ),
    ).toThrow('ít nhất 32 byte');
  });
});
