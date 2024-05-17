import { Column, Entity } from 'typeorm';
import BaseEntity from '../../base-entity.entity';

@Entity()
export default class User extends BaseEntity {
  @Column()
  name: string;

  @Column()
  email: string;

  @Column()
  role: string;

  @Column()
  googleId: string;
}
