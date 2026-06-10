import { expect, userEvent } from 'storybook/test';
import './.emited/BenchApp';

export default { title: 'Compiled/BenchApp' };

export const Default = {
    render: () => '<bench-app></bench-app>',
    play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
        const app = canvasElement.querySelector('bench-app');
        const root = app?.shadowRoot;
        if (!root) throw new Error('bench-app did not render a shadow root');

        const buttons = root.querySelectorAll('.bar button');
        const tbody = root.querySelector('tbody');
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

        const trs = () => tbody.querySelectorAll('tr');

        // initially empty
        expect(trs().length).toBe(0);

        // Create 1,000 rows; each row has id, label and remove cells
        await userEvent.click(createBtn);
        expect(trs().length).toBe(1000);
        const firstRow = trs()[0];
        expect(firstRow.querySelector('.col-id')?.textContent).toBe('1');
        const firstLabel = firstRow.querySelector('.lbl');
        const firstLabelText = firstLabel?.textContent ?? '';
        expect(firstLabelText.length).toBeGreaterThan(0);
        expect(firstRow.querySelector('.remove')?.textContent).toBe('×');

        // selecting a row via its .lbl link adds the danger class to that tr only
        expect(firstRow.classList.contains('danger')).toBe(false);
        await userEvent.click(firstLabel as HTMLElement);
        expect(firstRow.classList.contains('danger')).toBe(true);
        // selection is exclusive: exactly one row is marked danger
        expect(tbody.querySelectorAll('tr.danger').length).toBe(1);

        // selecting a different row moves the danger marker
        const secondRow = trs()[1];
        await userEvent.click(secondRow.querySelector('.lbl') as HTMLElement);
        expect(secondRow.classList.contains('danger')).toBe(true);
        expect(trs()[0].classList.contains('danger')).toBe(false);
        expect(tbody.querySelectorAll('tr.danger').length).toBe(1);

        // Update every 10th row appends " !!!" to those labels (rows 0,10,20,...)
        await userEvent.click(updateBtn);
        const updatedRows = trs();
        expect(updatedRows[0].querySelector('.lbl')?.textContent).toBe(
            `${firstLabelText} !!!`,
        );
        // a non-10th row (index 1) is unchanged
        expect(updatedRows[1].querySelector('.lbl')?.textContent?.endsWith(' !!!')).toBe(
            false,
        );

        // Swap Rows exchanges row index 1 and index 998 (needs > 998 rows)
        const idAt1 = trs()[1].querySelector('.col-id')?.textContent;
        const idAt998 = trs()[998].querySelector('.col-id')?.textContent;
        expect(idAt1).not.toBe(idAt998);
        await userEvent.click(swapBtn);
        expect(trs()[1].querySelector('.col-id')?.textContent).toBe(idAt998);
        expect(trs()[998].querySelector('.col-id')?.textContent).toBe(idAt1);
        // count is unchanged by a swap
        expect(trs().length).toBe(1000);

        // Append 1,000 rows grows the list to 2,000
        await userEvent.click(appendBtn);
        expect(trs().length).toBe(2000);

        // removing a row via its × link drops exactly one row
        const removeId = trs()[0].querySelector('.col-id')?.textContent;
        await userEvent.click(trs()[0].querySelector('.remove') as HTMLElement);
        expect(trs().length).toBe(1999);
        expect(trs()[0].querySelector('.col-id')?.textContent).not.toBe(removeId);

        // Clear empties the table
        await userEvent.click(clearBtn);
        expect(trs().length).toBe(0);

        // Create 10,000 rows (assert representative count, not every row)
        await userEvent.click(createLotsBtn);
        expect(trs().length).toBe(10000);

        // Clear again to leave the table empty
        await userEvent.click(clearBtn);
        expect(trs().length).toBe(0);

        // Swap Rows is a no-op when there are not enough rows (length <= 998)
        await userEvent.click(swapBtn);
        expect(trs().length).toBe(0);
    },
};
