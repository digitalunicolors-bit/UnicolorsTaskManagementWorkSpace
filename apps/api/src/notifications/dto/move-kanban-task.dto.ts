import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class MoveKanbanTaskDto {
  @IsString()
  @IsIn([
    'TODO',
    'IN_PROGRESS',
    'REVIEW',
    'CHANGES_REQUESTED',
    'DONE',
  ])
  targetCode!:
    | 'TODO'
    | 'IN_PROGRESS'
    | 'REVIEW'
    | 'CHANGES_REQUESTED'
    | 'DONE';

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  note?: string;
}
