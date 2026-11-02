import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContentStatus, StatusChange } from '../../core/api/models';
import { AuthService } from '../../core/auth/auth.service';
import { loginResponse, provideAppTesting } from '../../../testing/test-providers';
import { StatusActionsComponent } from './status-actions';

@Component({ imports: [StatusActionsComponent], template: `<app-status-actions [status]="status" [busy]="busy" (change)="changes.push($event)" />` })
class Host { status: ContentStatus = 'DRAFT'; busy = false; changes: StatusChange[] = []; }

describe('StatusActionsComponent (editorial workflow)', () => {
  let fixture: ComponentFixture<Host>;

  const setup = async (permissions: string[], status: ContentStatus, busy = false) => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    const r = loginResponse(permissions);
    (TestBed.inject(AuthService) as unknown as { set: (s: unknown) => void }).set({ token: 't', expiresAt: r.expiresAt, user: r.user });
    fixture = TestBed.createComponent(Host);
    fixture.componentInstance.status = status;
    fixture.componentInstance.busy = busy;
    await fixture.whenStable();
  };
  const buttons = () => [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.flex-col > button')];
  const labels = () => buttons().map((b) => b.textContent!.trim());
  afterEach(() => localStorage.clear());

  const EDITOR = ['CONTENT_WRITE'], PUBLISHER = ['CONTENT_WRITE', 'CONTENT_PUBLISH'];

  it('an editor can only send a draft for review, never publish it', async () => {
    await setup(EDITOR, 'DRAFT');
    expect(labels()).toEqual(['workflow.submit']);
  });

  it('an editor can withdraw a pending item and has no actions on live content', async () => {
    await setup(EDITOR, 'PENDING_REVIEW');
    expect(labels()).toEqual(['workflow.withdraw']);
    TestBed.resetTestingModule();
    await setup(EDITOR, 'PUBLISHED');
    expect(labels()).toEqual([]);
    TestBed.resetTestingModule();
    await setup(EDITOR, 'ARCHIVED');
    expect(labels()).toEqual([]);
  });

  it('a publisher can publish a draft right away or schedule it', async () => {
    await setup(PUBLISHER, 'DRAFT');
    expect(labels()).toEqual(['workflow.publishNow', 'workflow.schedule']);
  });

  it('a publisher approves or sends back items pending review', async () => {
    await setup(PUBLISHER, 'PENDING_REVIEW');
    expect(labels()).toEqual(['workflow.approvePublish', 'workflow.backToDraft', 'workflow.schedule']);
  });

  it('a publisher can unpublish or archive live content, and restore archived content', async () => {
    await setup(PUBLISHER, 'PUBLISHED');
    expect(labels()).toEqual(['workflow.unpublish', 'workflow.archive']);
    TestBed.resetTestingModule();
    await setup(PUBLISHER, 'ARCHIVED');
    expect(labels()).toEqual(['workflow.publishNow', 'workflow.restore', 'workflow.schedule']);
  });

  it('emits the chosen status', async () => {
    await setup(PUBLISHER, 'DRAFT');
    buttons()[0].click();
    expect(fixture.componentInstance.changes).toEqual([{ status: 'PUBLISHED' }]);
  });

  it('disables the buttons while a change is being saved', async () => {
    await setup(PUBLISHER, 'DRAFT', true);
    expect(buttons().every((b) => b.disabled)).toBe(true);
  });
});
