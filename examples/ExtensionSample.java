public class ExtensionSample {
    public static int score(int[] values, int minimum) {
        if (values == null) {
            return 0;
        }

        int total = 0;
        for (int value : values) {
            if (value >= minimum) {
                total += value;
            }
        }

        for (int i = 0; i < 2; i++) {
            total += i;
        }

        while (total > 100) {
            total -= 10;
        }

        do {
            total++;
        } while (total < 1);

        return total;
    }

    public static void main(String[] args) {
        System.out.println(score(new int[] { 5, 12, 20 }, 10));
    }
}
