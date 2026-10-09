import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, X } from 'lucide-react';

export default function RoomMoreMenu({ groups }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const close = () => { setOpen(false); triggerRef.current?.focus(); };
  const visibleItems = () => [...(menuRef.current?.querySelectorAll('[role^="menuitem"]:not([disabled])') || [])]
    .filter(button => getComputedStyle(button).display !== 'none'
      && getComputedStyle(button.closest('.exmeet-menu-group')).display !== 'none');

  useEffect(() => {
    if (!open) return;
    const outside = event => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    visibleItems()[0]?.focus();
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  function onKeyDown(event) {
    if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); }
      close();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const buttons = visibleItems();
    if (!buttons.length) return;
    const index = buttons.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus();
  }

  return <div className="exmeet-more" ref={rootRef}>
    <button type="button" ref={triggerRef} className="exmeet-control" title="More" aria-label="More"
      aria-haspopup="menu" aria-expanded={open} aria-controls="meeting-more-menu" data-active={open || undefined}
      onClick={() => setOpen(value => !value)}><MoreHorizontal size={20}/></button>
    {open && <div id="meeting-more-menu" className="exmeet-more-menu" onKeyDown={onKeyDown}>
      <div className="exmeet-menu-header"><span>More options</span>
        <button type="button" title="Close more options" aria-label="Close more options" onClick={close}><X size={16}/></button>
      </div>
      <div className="exmeet-menu-body" role="menu" aria-label="More meeting options" ref={menuRef}>
        {groups.filter(group => group.items.length).map(group => <div key={group.label} role="group" aria-label={group.label}
          className={`exmeet-menu-group${group.compactOnly ? ' exmeet-menu-compact-group' : ''}`}>
          <div className="exmeet-menu-heading" aria-hidden="true">{group.label}</div>
          <div className="exmeet-menu-grid">{group.items.map(item => <button key={item.label} type="button" tabIndex={-1}
            role={item.active === undefined ? 'menuitem' : 'menuitemcheckbox'} aria-checked={item.active}
            disabled={item.disabled} className={`exmeet-menu-item${item.compactOnly ? ' exmeet-menu-compact-only' : ''}`}
            onClick={() => { close(); item.action(); }}>
            <span className="exmeet-menu-icon">{item.icon}</span><span>{item.label}</span>
            {item.active && <span className="exmeet-menu-active" aria-hidden="true"/>}
          </button>)}</div>
        </div>)}
      </div>
    </div>}
  </div>;
}
