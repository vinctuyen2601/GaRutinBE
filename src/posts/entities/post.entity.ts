import {
  Entity, Column, PrimaryGeneratedColumn,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
} from 'typeorm';

@Entity('posts')
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ unique: true })
  slug: string;

  @Column({ nullable: true })
  content: string;

  @Column({ nullable: true })
  excerpt: string;

  @Column({ name: 'cover_image', nullable: true })
  coverImage: string;

  @Column({ nullable: true })
  category: string;

  @Column({ type: 'jsonb', default: [] })
  tags: string[];

  @Column({ default: 'draft' })
  status: 'draft' | 'published' | 'archived';

  @Column({ name: 'published_at', nullable: true, type: 'timestamptz' })
  publishedAt: Date;

  @Column({ name: 'seo_title', nullable: true })
  seoTitle: string;

  @Column({ name: 'seo_description', nullable: true })
  seoDescription: string;

  @Column({ name: 'keyword_id', nullable: true })
  keywordId: string;

  @Column({ name: 'source_url', nullable: true })
  sourceUrl: string;

  @Column({ name: 'seo_score', type: 'int', nullable: true })
  seoScore: number;

  @Column({ name: 'content_score', type: 'int', nullable: true })
  contentScore: number;

  @Column({ name: 'seo_details', type: 'jsonb', nullable: true })
  seoDetails: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
