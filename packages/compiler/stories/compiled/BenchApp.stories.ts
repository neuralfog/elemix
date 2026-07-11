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

        // bar buttons in DOM order
        const [createBtn, createLotsBtn, appendBtn, updateBtn, clearBtn, swapBtn] =
            Array.from(buttons) as HTMLElement[];
        expect(createBtn.textContent?.trim()).toBe('Create 1,000 rows');
        expect(createLotsBtn.textContent?.trim()).toBe('Create 10,000 rows');
        expect(appendBtn.textContent?.trim()).toBe('Append 1,000 rows');
        expect(updateBtn.textContent?.trim()).toBe('Update every 10th row');
        expect(clearBtn.textContent?.trim()).toBe('Clear');
        expect(swapBtn.textContent?.trim()).toBe('Swap Rows');

        const trs = () => query('tr', tbody);

        // initially empty
        expect(trs().length).toBe(0);

        // Create 1,000 rows; each row has id, label and remove cells
        click(createBtn);
        expect(trs().length).toBe(1000);
        const firstRow = trs()[0];
        expect(find('.col-id', firstRow)?.textContent).toBe('1');
        const firstLabel = find('.lbl', firstRow);
        const firstLabelText = firstLabel?.textContent ?? '';
        expect(firstLabelText.length).toBeGreaterThan(0);
        expect(find('.remove', firstRow)?.textContent).toBe('×');

        // selecting a row via its .lbl link adds the danger class to that tr only
        expect(firstRow.classList.contains('danger')).toBe(false);
        click(firstLabel as HTMLElement);
        expect(firstRow.classList.contains('danger')).toBe(true);
        // selection is exclusive: exactly one row is marked danger
        expect(query('tr.danger', tbody).length).toBe(1);

        // selecting a different row moves the danger marker
        const secondRow = trs()[1];
        click(find('.lbl', secondRow) as HTMLElement);
        expect(secondRow.classList.contains('danger')).toBe(true);
        expect(trs()[0].classList.contains('danger')).toBe(false);
        expect(query('tr.danger', tbody).length).toBe(1);

        // Update every 10th row appends " !!!" to those labels (rows 0,10,20,...)
        click(updateBtn);
        const updatedRows = trs();
        expect(find('.lbl', updatedRows[0])?.textContent).toBe(
            `${firstLabelText} !!!`,
        );
        // a non-10th row (index 1) is unchanged
        expect(find('.lbl', updatedRows[1])?.textContent?.endsWith(' !!!')).toBe(
            false,
        );

        // Swap Rows exchanges row index 1 and index 998 (needs > 998 rows)
        const idAt1 = find('.col-id', trs()[1])?.textContent;
        const idAt998 = find('.col-id', trs()[998])?.textContent;
        expect(idAt1).not.toBe(idAt998);
        click(swapBtn);
        expect(find('.col-id', trs()[1])?.textContent).toBe(idAt998);
        expect(find('.col-id', trs()[998])?.textContent).toBe(idAt1);
        // count is unchanged by a swap
        expect(trs().length).toBe(1000);

        // Append 1,000 rows grows the list to 2,000
        click(appendBtn);
        expect(trs().length).toBe(2000);

        // removing a row via its × link drops exactly one row
        const removeId = find('.col-id', trs()[0])?.textContent;
        click(find('.remove', trs()[0]) as HTMLElement);
        expect(trs().length).toBe(1999);
        expect(find('.col-id', trs()[0])?.textContent).not.toBe(removeId);

        // Clear empties the table
        click(clearBtn);
        expect(trs().length).toBe(0);

        // Create 10,000 rows (assert representative count, not every row)
        click(createLotsBtn);
        expect(trs().length).toBe(10000);

        // Clear again to leave the table empty
        click(clearBtn);
        expect(trs().length).toBe(0);

        // Swap Rows is a no-op when there are not enough rows (length <= 998)
        click(swapBtn);
        expect(trs().length).toBe(0);
    },
};
