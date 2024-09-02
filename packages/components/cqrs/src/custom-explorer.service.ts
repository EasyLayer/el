import { Injectable } from '@nestjs/common';
import { IEvent } from '@nestjs/cqrs';
import { ModulesContainer } from '@nestjs/core/injector/modules-container';
import { ExplorerService } from '@nestjs/cqrs/dist/services/explorer.service';
import { CqrsOptions } from '@nestjs/cqrs/dist/interfaces/cqrs-options.interface';
import { setEventMetadataByHandlers } from './utils';

export interface IExtendedOptions extends CqrsOptions {}

@Injectable()
export class CustomExplorerService<EventBase extends IEvent = IEvent> extends ExplorerService<EventBase> {
  private customModulesContainer: ModulesContainer;

  constructor(modulesContainer: ModulesContainer) {
    super(modulesContainer);
    this.customModulesContainer = modulesContainer;
  }

  explore(): IExtendedOptions {
    const baseOptions = super.explore();

    // const modules = [...this.customModulesContainer.values()];
    // const projectionUpdaters = this.flatMap<IProjectionUpdater>(modules, (instance) => this.filterProvider(instance, PROJECTION_UPDATER_METADATA));

    const { events } = baseOptions;

    if (events) {
      setEventMetadataByHandlers(events);
    }

    return { ...baseOptions, events };
  }
}
