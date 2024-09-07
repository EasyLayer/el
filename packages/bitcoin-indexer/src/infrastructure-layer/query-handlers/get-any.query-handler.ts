import { IQueryHandler, QueryHandler } from '@el/components/cqrs';
import { GetAnyQuery } from '@el/common/domain-cqrs-components/bitcoin-indexer';
import { ViewsReadRepositoryService } from '../services/views-read-repository.service';

@QueryHandler(GetAnyQuery)
export class GetAnyQueryHandler implements IQueryHandler<GetAnyQuery> {
  constructor(private readonly viewsReadRepository: ViewsReadRepositoryService) {}

  async execute({ payload }: GetAnyQuery): Promise<any> {
    const { prefix, coditions, relations } = payload;
    console.log(prefix, coditions, relations);
    // return this.viewsReadRepository.find();
  }
}