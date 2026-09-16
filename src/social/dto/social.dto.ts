import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class SendFriendRequestDto {
  @ApiProperty({ description: 'User ID or email of the person to add' })
  @IsString()
  addressee!: string;
}

export class FriendDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty({ description: 'Whether the friend is currently online' })
  online!: boolean;
}

export class FriendRequestDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  requesterId!: string;

  @ApiProperty()
  requesterName!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  createdAt!: Date;
}

export class SendMessageDto {
  @ApiProperty({ description: 'Receiver user ID' })
  @IsString()
  receiverId!: string;

  @ApiProperty({ description: 'Message content' })
  @IsString()
  content!: string;
}

export class ChatMessageDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  senderId!: string;

  @ApiProperty()
  receiverId!: string;

  @ApiProperty()
  content!: string;

  @ApiPropertyOptional()
  readAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;
}