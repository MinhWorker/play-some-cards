import { Global, Module } from '@nestjs/common';
import { ShopService } from './shop.service.js';

@Global()
@Module({ providers: [ShopService], exports: [ShopService] })
export class ShopModule {}
