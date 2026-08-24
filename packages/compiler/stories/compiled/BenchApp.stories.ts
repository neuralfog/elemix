import { expect } from '@neuralfog/elemix-testing-library';
import { click } from '@neuralfog/elemix-testing-library/events';
import { find, query } from '@neuralfog/elemix-testing-library/query';
import './.emited/BenchApp';

export default { title: 'Compiled/BenchApp' };

export const Default = {
    render: () => '<bench-app></bench-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const buttons = query('.bar button', canvasElement);
        const tbody = find('tbody', canvasElement);
        if (!tbody) throw new Error('bench-app did not render a tbody');

        const [createBtn, createLotsBtn, appendBtn, updateBtn, clearBtn, swapBtn] =
            Array.from(buttons) as HTMLElement[];
        expect(createBtn.textContent?.trim()).toBe('Create 1,000 rows');
        expect(createLotsBtn.textContent?.trim()).toBe('Create 10,000 rows');
        expect(appendBtn.textContent?.trim()).toBe('Append 1,000 rows');
        expect(updateBtn.textContent?.trim()).toBe('Update every 10th row');
        expect(clearBtn.textContent?.trim()).toBe('Clear');
        expect(swapBtn.textContent?.trim()).toBe('Swap Rows');

        const trs = () => query('tr', tbody);

        expect(trs().length).toBe(0);

        click(createBtn);
        expect(trs().length).toBe(1000);
        const firstRow = trs()[0];
        expect(find('.col-id', firstRow)?.textContent).toBe('1');
        const firstLabel = find('.lbl', firstRow);
        const firstLabelText = firstLabel?.textContent ?? '';
        expect(firstLabelText.length).toBeGreaterThan(0);
        expect(find('.remove', firstRow)?.textContent).toBe('×');

        expect(firstRow.classList.contains('danger')).toBe(false);
        click(firstLabel as HTMLElement);
        expect(firstRow.classList.contains('danger')).toBe(true);
        expect(query('tr.danger', tbody).length).toBe(1);

        const secondRow = trs()[1];
        click(find('.lbl', secondRow) as HTMLElement);
        expect(secondRow.classList.contains('danger')).toBe(true);
        expect(trs()[0].classList.contains('danger')).toBe(false);
        expect(query('tr.danger', tbody).length).toBe(1);

        click(updateBtn);
        const updatedRows = trs();
        expect(find('.lbl', updatedRows[0])?.textContent).toBe(
            `${firstLabelText} !!!`,
        );
        expect(find('.lbl', updatedRows[1])?.textContent?.endsWith(' !!!')).toBe(
            false,
        );

        const idAt1 = find('.col-id', trs()[1])?.textContent;
        const idAt998 = find('.col-id', trs()[998])?.textContent;
        expect(idAt1).not.toBe(idAt998);
        click(swapBtn);
        expect(find('.col-id', trs()[1])?.textContent).toBe(idAt998);
        expect(find('.col-id', trs()[998])?.textContent).toBe(idAt1);
        expect(trs().length).toBe(1000);

        click(appendBtn);
        expect(trs().length).toBe(2000);

        const removeId = find('.col-id', trs()[0])?.textContent;
        click(find('.remove', trs()[0]) as HTMLElement);
        expect(trs().length).toBe(1999);
        expect(find('.col-id', trs()[0])?.textContent).not.toBe(removeId);

        click(clearBtn);
        expect(trs().length).toBe(0);

        click(createLotsBtn);
        expect(trs().length).toBe(10000);

        click(clearBtn);
        expect(trs().length).toBe(0);

        click(swapBtn);
        expect(trs().length).toBe(0);
    },
};
